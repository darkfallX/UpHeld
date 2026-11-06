"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

interface DecryptedTextProps {
  text: string;
  speed?: number;
  maxIterations?: number;
  className?: string;
  characters?: string;
  animateOnMount?: boolean;
}

const DEFAULT_CHARS = "01010101_ABCDEF123456789!<>~#*";

export function DecryptedText({
  text,
  speed = 40,
  maxIterations = 10,
  className = "",
  characters = DEFAULT_CHARS,
  animateOnMount = true,
}: DecryptedTextProps) {
  const [displayText, setDisplayText] = useState(text);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion || !animateOnMount) {
      setDisplayText(text);
      return;
    }

    let iteration = 0;
    const interval = setInterval(() => {
      setDisplayText(
        text
          .split("")
          .map((char, index) => {
            if (char === " ") return " ";
            if (index < iteration) {
              return text[index];
            }
            return characters[Math.floor(Math.random() * characters.length)];
          })
          .join("")
      );

      if (iteration >= text.length) {
        clearInterval(interval);
      }

      iteration += 1 / (maxIterations / text.length);
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed, maxIterations, characters, animateOnMount, reduceMotion]);

  return <span className={className}>{displayText}</span>;
}

export default DecryptedText;
