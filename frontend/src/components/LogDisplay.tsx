"use client";

import { useLogStore } from "@/stores/logStore";
import { ReactElement, useEffect, useRef } from "react";

import styles from "./LogDisplay.module.scss";

const LogDisplay = (): ReactElement | null => {
  const logs = useLogStore((state) => state.logs);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  if (logs.length === 0) {
    return null;
  }

  return (
    <div ref={containerRef} className={styles.container}>
      {logs.map((log, index) => (
        <div key={index} className={styles.logEntry}>
          {log}
        </div>
      ))}
    </div>
  );
};

export default LogDisplay;
