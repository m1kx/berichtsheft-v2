"use client";

import { useResultStore } from "@/stores/resultStore";
import { useWeekStore } from "@/stores/weekStore";
import { ReactElement, useState } from "react";

import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import styles from "./SubmitButton.module.scss";

const SubmitButton = (): ReactElement | null => {
  const [isLoading, setIsLoading] = useState(false);

  const resultStore = useResultStore((state) => state);
  const weeks = useWeekStore((state) => state.weeks);

  if (weeks.length === 0) {
    return <div className={styles.weekHint}>bitte wochen auswählen</div>;
  }

  const submit = async () => {
    setIsLoading(true);
    const response = await fetch("http://localhost:8000/generate", {
      method: "POST",
      body: JSON.stringify({ selectedWeeks: weeks }),
      headers: {
        "Content-Type": "application/json",
      },
    });
    const data = await response.json();

    for (const [key, value] of Object.entries(data)) {
      resultStore.setResultText(
        key,
        `${resultStore.resultText ? `${resultStore.resultText}\n` : ""}${value}`
      );
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
