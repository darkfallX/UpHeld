// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
}

/// @title UpHealthSLA: performance-backed USDC subscriptions with automatic SLA compensation
/// @notice Core escrow for UpHeld ("Uptime, Upheld on Base"), targeting Base Sepolia (84532).
///         Units: USDC in 6-decimal minor units, uptime/SLA/refunds in basis points (10000 = 100%).
/// @dev    Trust model: outages are recorded only by approved attestors (the deployer by default;
///         in production, an independent monitor network). Providers and subscribers cannot attest,
///         so neither side can grade its own homework. Each subscriber is credited at most the
///         refund for the worst tier reached; a deeper breach only pays the difference.
///         Every seat is fully backed: subscribing locks that subscriber's worst-case refund out of
///         the provider's reserve, so a provider can't sell coverage it can't pay, and refunds are paid
///         from each seat's own locked amount (no first-come race for a shared pool).
contract UpHealthSLA {
    IERC20 public immutable usdc;
    uint256 public constant BILLING_WINDOW_MINUTES = 43200; // 30 days

    struct Service {
        uint256 id;
        address provider;
        string name;
        uint256 monthlyPriceUsdc; // 6 decimals
        uint16 slaTargetBps;      // e.g. 9995 = 99.95%
        uint16 currentUptimeBps;  // starts at 10000 = 100.00%
        uint256 downtimeMinutes;
        uint256 reserveBalanceUsdc;
        uint16 minorRefundBps;    // e.g. 1000 = 10%
        uint16 moderateRefundBps; // e.g. 2500 = 25%
        uint16 severeRefundBps;   // e.g. 5000 = 50%
        bool active;
    }

    uint256 public nextServiceId = 1;
    mapping(uint256 => Service) public services;
    mapping(uint256 => address[]) public serviceSubscribers;
    mapping(address => mapping(uint256 => bool)) public isSubscribed;
    mapping(address => mapping(uint256 => uint256)) public claimableCompensation;
    /// @notice Refund already credited to a subscriber for the current breach, in USDC minor units.
    ///         A new attestation only pays the gap up to the current tier, never the same tier twice.
    mapping(address => mapping(uint256 => uint256)) public creditedCompensation;

    /// @notice Reserve locked for existing seats, per service. reserveBalanceUsdc >= committedReserve always.
    mapping(uint256 => uint256) public committedReserve;
    /// @notice Worst-case refund still locked for one subscriber's seat.
    mapping(address => mapping(uint256 => uint256)) public seatCover;

    address public owner;
    mapping(address => bool) public isAttestor;
    mapping(bytes32 => bool) public attestationUsed;

    event ServiceRegistered(uint256 indexed serviceId, address indexed provider, string name, uint256 priceUsdc, uint16 slaBps);
    event ReserveFunded(uint256 indexed serviceId, uint256 amountUsdc, uint256 newReserveBalance);
    event Subscribed(uint256 indexed serviceId, address indexed subscriber, uint256 priceUsdc);
    event OutageRecorded(uint256 indexed serviceId, uint256 downtimeMinutes, uint16 newUptimeBps, uint16 refundBps, bytes32 attestationHash);
    event CompensationClaimed(uint256 indexed serviceId, address indexed subscriber, uint256 amountUsdc);
    event AttestorUpdated(address indexed attestor, bool allowed);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor(address _usdc) {
        require(_usdc != address(0), "USDC address required");
        usdc = IERC20(_usdc);
        owner = msg.sender;
        isAttestor[msg.sender] = true;
        emit OwnershipTransferred(address(0), msg.sender);
        emit AttestorUpdated(msg.sender, true);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    function setAttestor(address attestor, bool allowed) external onlyOwner {
        require(attestor != address(0), "Zero address");
        isAttestor[attestor] = allowed;
        emit AttestorUpdated(attestor, allowed);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        // the outgoing owner stops being an attestor; the new owner becomes one
        isAttestor[owner] = false;
        emit AttestorUpdated(owner, false);
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
        isAttestor[newOwner] = true;
        emit AttestorUpdated(newOwner, true);
    }

    /// @notice Refund tier (bps of the monthly price) for an uptime reading. Shared by subscribe and recordOutage.
    function _refundBpsFor(Service storage svc, uint16 uptimeBps) internal view returns (uint16) {
        if (uptimeBps >= svc.slaTargetBps) return 0;
        if (uptimeBps < 9800) return svc.severeRefundBps;
        if (uptimeBps < 9900) return svc.moderateRefundBps;
        return svc.minorRefundBps;
    }

    function registerService(
        string calldata name,
        uint256 monthlyPriceUsdc,
        uint16 slaTargetBps,
        uint16 minorRefundBps,
        uint16 moderateRefundBps,
        uint16 severeRefundBps
    ) external returns (uint256 serviceId) {
        require(bytes(name).length > 0, "Name required");
        require(monthlyPriceUsdc > 0, "Price must be > 0");
        require(slaTargetBps > 0 && slaTargetBps <= 10000, "SLA target out of range");
        require(minorRefundBps <= moderateRefundBps && moderateRefundBps <= severeRefundBps && severeRefundBps <= 10000, "Tiers must ascend, max 100%");
        serviceId = nextServiceId++;
        services[serviceId] = Service({
            id: serviceId,
            provider: msg.sender,
            name: name,
            monthlyPriceUsdc: monthlyPriceUsdc,
            slaTargetBps: slaTargetBps,
            currentUptimeBps: 10000,
            downtimeMinutes: 0,
            reserveBalanceUsdc: 0,
            minorRefundBps: minorRefundBps,
            moderateRefundBps: moderateRefundBps,
            severeRefundBps: severeRefundBps,
            active: true
        });
        emit ServiceRegistered(serviceId, msg.sender, name, monthlyPriceUsdc, slaTargetBps);
    }

    function fundReserve(uint256 serviceId, uint256 amountUsdc) external {
        require(services[serviceId].active, "Service inactive");
        require(amountUsdc > 0, "Amount must be > 0");
        require(usdc.transferFrom(msg.sender, address(this), amountUsdc), "Reserve transfer failed");
        services[serviceId].reserveBalanceUsdc += amountUsdc;
        emit ReserveFunded(serviceId, amountUsdc, services[serviceId].reserveBalanceUsdc);
    }

    /// @notice Reserve not yet locked to a seat, available to back the next subscriber.
    function availableReserve(uint256 serviceId) public view returns (uint256) {
        return services[serviceId].reserveBalanceUsdc - committedReserve[serviceId];
    }

    /// @notice Reserve a new seat must lock: the severe-tier refund minus the credit it starts with.
    function seatCoverRequired(uint256 serviceId) public view returns (uint256) {
        Service storage svc = services[serviceId];
        uint256 worst = (svc.monthlyPriceUsdc * svc.severeRefundBps) / 10000;
        uint256 start = (svc.monthlyPriceUsdc * _refundBpsFor(svc, svc.currentUptimeBps)) / 10000;
        return worst - start;
    }

    /// @notice Tops every subscriber up to the refund for the service's current tier, paid from that
    ///         subscriber's own locked seat cover. Never pays the same tier twice.
    function _settle(uint256 serviceId) internal returns (uint16 refundBps) {
        Service storage svc = services[serviceId];
        refundBps = _refundBpsFor(svc, svc.currentUptimeBps);
        if (refundBps == 0) return 0;
        uint256 tierRefund = (svc.monthlyPriceUsdc * refundBps) / 10000;
        address[] storage subs = serviceSubscribers[serviceId];
        for (uint256 i = 0; i < subs.length; i++) {
            address sub = subs[i];
            uint256 already = creditedCompensation[sub][serviceId];
            if (tierRefund <= already) continue; // this tier (or a worse one) was already paid
            uint256 owed = tierRefund - already;
            // owed <= seatCover by construction (tiers ascend); the check keeps it true defensively
            if (seatCover[sub][serviceId] >= owed) {
                seatCover[sub][serviceId] -= owed;
                committedReserve[serviceId] -= owed;
                svc.reserveBalanceUsdc -= owed;
                creditedCompensation[sub][serviceId] = tierRefund;
                claimableCompensation[sub][serviceId] += owed;
            }
        }
    }

    function subscribe(uint256 serviceId) external {
        Service storage svc = services[serviceId];
        require(svc.active, "Service inactive");
        require(!isSubscribed[msg.sender][serviceId], "Already subscribed");
        // lock this seat's worst-case refund before taking payment: no backing, no sale
        uint256 cover = seatCoverRequired(serviceId);
        require(availableReserve(serviceId) >= cover, "Reserve can't back another seat");
        committedReserve[serviceId] += cover;
        seatCover[msg.sender][serviceId] = cover;
        isSubscribed[msg.sender][serviceId] = true;
        serviceSubscribers[serviceId].push(msg.sender);
        // Joining mid-breach is not compensated for downtime that happened before you subscribed:
        // start the subscriber's credit at the current tier so only further degradation pays.
        creditedCompensation[msg.sender][serviceId] = (svc.monthlyPriceUsdc * _refundBpsFor(svc, svc.currentUptimeBps)) / 10000;
        require(usdc.transferFrom(msg.sender, svc.provider, svc.monthlyPriceUsdc), "Subscription payment failed");
        emit Subscribed(serviceId, msg.sender, svc.monthlyPriceUsdc);
    }

    function recordOutage(uint256 serviceId, uint256 additionalDowntimeMinutes, bytes32 attestationHash) external {
        require(isAttestor[msg.sender], "Not an attestor");
        Service storage svc = services[serviceId];
        require(svc.active, "Service inactive");
        require(additionalDowntimeMinutes > 0, "No downtime");
        require(attestationHash != bytes32(0) && !attestationUsed[attestationHash], "Attestation reused");
        attestationUsed[attestationHash] = true;

        svc.downtimeMinutes += additionalDowntimeMinutes;
        if (svc.downtimeMinutes >= BILLING_WINDOW_MINUTES) {
            svc.currentUptimeBps = 0;
        } else {
            svc.currentUptimeBps = uint16(((BILLING_WINDOW_MINUTES - svc.downtimeMinutes) * 10000) / BILLING_WINDOW_MINUTES);
        }

        uint16 refundBps = _settle(serviceId);

        emit OutageRecorded(serviceId, svc.downtimeMinutes, svc.currentUptimeBps, refundBps, attestationHash);
    }

    function claimCompensation(uint256 serviceId) external {
        uint256 owed = claimableCompensation[msg.sender][serviceId];
        require(owed > 0, "No compensation available");
        claimableCompensation[msg.sender][serviceId] = 0;
        require(usdc.transfer(msg.sender, owed), "Compensation transfer failed");
        emit CompensationClaimed(serviceId, msg.sender, owed);
    }
}
