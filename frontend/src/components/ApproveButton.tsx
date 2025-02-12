"use client";

import { useLogStore } from "@/stores/logStore";
import { useResultStore } from "@/stores/resultStore";
import { useWeekStore } from "@/stores/weekStore";
import { faCheck, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ReactElement, useState } from "react";

const ApproveButton = (): ReactElement => {
  const [isLoading, setIsLoading] = useState(false);

  const resultStore = useResultStore((state) => state);
  const weekStore = useWeekStore((state) => state);
  const logStore = useLogStore((state) => state);

  const approve = async () => {
    if (!resultStore.resultText) {
      return;
    }

    setIsLoading(true);

    logStore.addLog("Stating approval...");
    const response = await fetch("http://localhost:8000/approve", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(resultStore.resultText)),
      headers: {
        "Content-Type": "application/json",
      },
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
          logStore.addLog(msg);
        }
      }
    }
    setIsLoading(false);
    resultStore.removeAll();
    weekStore.setWeeks([]);
  };

  return (
    <button disabled={isLoading} onClick={approve}>
      {isLoading ? (
        <FontAwesomeIcon spin icon={faSpinner} />
      ) : (
        <>
          Approve <FontAwesomeIcon icon={faCheck} />
        </>
      )}
    </button>
  );
};

export default ApproveButton;
