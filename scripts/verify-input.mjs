// Writes the solc Standard JSON input for each contract, ready to paste into BaseScan's
// "Verify & Publish" form (Compiler type: "Solidity (Standard-Json-Input)").
//
// Usage:
//   npm run verify:input                      -> writes contracts/verify/*.standard-input.json
//   npm run verify:input -- 0xYourMockUSDC    -> also prints UpHealthSLA's ABI-encoded constructor args
//
// The settings mirror scripts/compile-contracts.mjs exactly (optimizer on, 200 runs, evmVersion "paris"),
// so the bytecode BaseScan rebuilds matches what /contracts deploys from src/lib/contract-artifacts.ts.
// This script never reads, asks for or stores a private key.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import solc from "solc";
import { encodeAbiParameters, getAddress, isAddress } from "viem";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "contracts", "verify");
const artifactsFile = path.join(root, "src", "lib", "contract-artifacts.ts");

// Same settings as scripts/compile-contracts.mjs. Do not change one without the other.
const settings = {
  optimizer: { enabled: true, runs: 200 },
  evmVersion: "paris",
  outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
};

const targets = [
  { file: "UpHealthSLA.sol", name: "UpHealthSLA", artifactKey: "upHealthSlaBytecode" },
  { file: "MockUSDC.sol", name: "MockUSDC", artifactKey: "mockUsdcBytecode" },
];

const artifacts = fs.existsSync(artifactsFile) ? fs.readFileSync(artifactsFile, "utf8") : "";
const artifactBytecode = (key) => artifacts.match(new RegExp(`export const ${key} = "0x([0-9a-fA-F]*)"`))?.[1]?.toLowerCase();

/** Sources exactly as they were compiled into contract-artifacts.ts (fallback if contracts/*.sol drifted). */
function artifactSources() {
  const m = artifacts.match(/export const contractSources = (\{[\s\S]*?\n\}) as const;/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

function buildInput(file, content) {
  return { language: "Solidity", sources: { [file]: { content } }, settings };
}

function compile(input, file, name) {
  const out = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (out.errors ?? []).filter((e) => e.severity === "error");
  if (errors.length) {
    for (const e of errors) console.error(e.formattedMessage);
    process.exit(1);
  }
  return out.contracts[file][name].evm.bytecode.object.toLowerCase();
}

fs.mkdirSync(outDir, { recursive: true });
const embedded = artifactSources();
const version = solc.version();

console.log("\nBaseScan verification inputs");
console.log("----------------------------");
for (const t of targets) {
  let content = fs.readFileSync(path.join(root, "contracts", t.file), "utf8");
  let input = buildInput(t.file, content);
  let bytecode = compile(input, t.file, t.name);
  const expected = artifactBytecode(t.artifactKey);
  let note = "no artifact to compare";

  if (expected) {
    if (bytecode === expected) {
      note = "matches src/lib/contract-artifacts.ts";
    } else if (embedded?.[t.file]) {
      // contracts/*.sol differs from what the app deploys: use the exact source the app was built from.
      content = embedded[t.file];
      input = buildInput(t.file, content);
      bytecode = compile(input, t.file, t.name);
      note =
        bytecode === expected
          ? "matches src/lib/contract-artifacts.ts (used its embedded source; contracts/ has drifted, run npm run compile:contracts)"
          : "DOES NOT match src/lib/contract-artifacts.ts. Run npm run compile:contracts, redeploy, then rerun this script";
    } else {
      note = "DOES NOT match src/lib/contract-artifacts.ts. Run npm run compile:contracts, redeploy, then rerun this script";
    }
  }

  const outFile = path.join(outDir, `${t.name}.standard-input.json`);
  fs.writeFileSync(outFile, JSON.stringify(input, null, 2) + "\n");
  console.log(`${t.name.padEnd(12)} -> ${path.relative(root, outFile).split(path.sep).join("/")}`);
  console.log(`${"".padEnd(12)}    contract name: ${t.file}:${t.name}`);
  console.log(`${"".padEnd(12)}    bytecode ${note}`);
}

// BaseScan lists versions without solc-js's build suffix (".Emscripten.clang").
const basescanVersion = `v${version.replace(/\.Emscripten.*$/, "")}`;
console.log(`\nCompiler version to pick on BaseScan: ${basescanVersion}`);
console.log(`  (solc-js reports ${version})`);
console.log("Compiler type: Solidity (Standard-Json-Input). License: MIT.");

const usdcArg = process.argv.slice(2).find((a) => a.startsWith("0x"));
if (usdcArg) {
  if (!isAddress(usdcArg)) {
    console.error(`\n"${usdcArg}" is not a valid address. Pass the MockUSDC address, e.g. npm run verify:input -- 0x1234...`);
    process.exit(1);
  }
  const encoded = encodeAbiParameters([{ name: "_usdc", type: "address" }], [getAddress(usdcArg)]);
  console.log("\nUpHealthSLA constructor arguments (ABI-encoded, already without 0x, as BaseScan expects):");
  console.log(encoded.slice(2));
  console.log("MockUSDC has no constructor arguments; leave that box empty.");
} else {
  console.log("\nTip: npm run verify:input -- <MockUSDC address> also prints UpHealthSLA's constructor arguments.");
}
console.log("");
