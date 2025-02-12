"use client";

import { ReactElement } from "react";
import SubmitButton from "./SubmitButton";

import { useResultStore } from "@/stores/resultStore";
import styles from "./ActionButtons.module.scss";
import ApproveButton from "./ApproveButton";

const ActionButtons = (): ReactElement => {
  const resultText = useResultStore((state) => state.resultText);

  return (
    <div className={styles.container}>
      {resultText ? <ApproveButton /> : <SubmitButton />}
    </div>
  );
};

export default ActionButtons;
