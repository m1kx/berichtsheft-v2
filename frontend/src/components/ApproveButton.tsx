"use client";

import { useResultStore } from "@/stores/resultStore";
import { useWeekStore } from "@/stores/weekStore";
import { faCheck, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ReactElement, useState } from "react";

const ApproveButton = (): ReactElement => {
  const [isLoading, setIsLoading] = useState(false);

  const resultStore = useResultStore((state) => state);
  const weekStore = useWeekStore((state) => state);

  const approve = async () => {
    if (!resultStore.resultText) {
      return;
    }

    setIsLoading(true);
    const response = await fetch("http://localhost:8000/approve", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(resultStore.resultText)),
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) {
      setIsLoading(false);
      resultStore.removeAll();
      weekStore.setWeeks([]);
      return;
    }
    await response.json();
    setIsLoading(false);
    resultStore.removeAll();
    weekStore.setWeeks([]);
  };

  return (
    <button disabled={isLoading} onClick={() => approve()}>
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
