"use client";

import { useResultStore } from "@/stores/resultStore";
import { useWeekStore } from "@/stores/weekStore";
import { ReactElement, useState } from "react";

import { useLogStore } from "@/stores/logStore";
import { WeekReport } from "@/types/api";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import styles from "./SubmitButton.module.scss";

const SubmitButton = (): ReactElement | null => {
  const [isLoading, setIsLoading] = useState(false);

  const resultStore = useResultStore((state) => state);
  const weeks = useWeekStore((state) => state.weeks);
  const logStore = useLogStore((state) => state);

  const fetchCheckout = async () => {
    if (isLoading) return;

    setIsLoading(true);

    const response = await fetch("http://localhost:8000/checkout");
    const data = await response.json();

    resultStore.setResultText("checkout", data.messages.join("\n"));

    setIsLoading(false);
  };

  if (weeks.length === 0) {
    return (
      <div className={styles.weekHint}>
        bitte wochen auswählen oder{" "}
        <a onClick={fetchCheckout} className={styles.checkoutLink}>
          {isLoading ? "..." : "checkout"}
        </a>
      </div>
    );
  }

  const submit = async () => {
    setIsLoading(true);
    logStore.addLog("Starting...");
    const response = await fetch("http://localhost:8000/generate", {
      method: "POST",
      body: JSON.stringify({ selectedWeeks: weeks }),
      headers: { "Content-Type": "application/json" },
    });
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value);
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";
      for (const part of parts) {
        if (part.startsWith("data:")) {
          const msg = part.replace("data:", "").trim();
          try {
            const data = JSON.parse(msg);
            Object.entries(data).forEach(([key, value]) => {
              resultStore.setResultText(key, {
                finalString: `${
                  resultStore.resultText ? `${resultStore.resultText}\n` : ""
                }${(value as WeekReport).finalString}`,
                totalHoursLost: (value as WeekReport).totalHoursLost,
              });
            });
          } catch {
            logStore.addLog(msg);
          }
        }
      }
    }
    setIsLoading(false);
  };

  return (
    <button disabled={isLoading} onClick={submit}>
      {isLoading ? (
        <FontAwesomeIcon spin icon={faSpinner} />
      ) : (
        <>
          einträge generieren ({weeks.length} woche
          {weeks.length === 1 ? "" : "n"})
        </>
      )}
    </button>
  );
};

export default SubmitButton;
