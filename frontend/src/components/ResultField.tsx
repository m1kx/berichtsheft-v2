"use client";

import { useResultStore } from "@/stores/resultStore";
import { ReactElement } from "react";

import styles from "./ResultField.module.scss";

const ResultField = (): ReactElement | null => {
  const resultStore = useResultStore((state) => state);

  if (!resultStore.resultText) {
    return null;
  }

  return (
    <>
      {Array.from(resultStore.resultText.keys()).map((key) => (
        <textarea
          key={key}
          name=""
          id=""
          value={resultStore.resultText?.get(key)?.finalString ?? ""}
          onChange={(e) =>
            resultStore.setResultText(key, {
              finalString: e.currentTarget.value,
              totalHoursLost:
                resultStore.resultText?.get(key)?.totalHoursLost ?? 0,
            })
          }
          className={styles.area}
        ></textarea>
      ))}
    </>
  );
};

export default ResultField;
