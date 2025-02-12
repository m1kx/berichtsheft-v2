"use client";

import { TimeRange, useWeekStore } from "@/stores/weekStore";
import classNames from "classnames";
import { ReactElement, useMemo } from "react";

import { useResultStore } from "@/stores/resultStore";
import styles from "./WeekSelector.module.scss";

const WeekSelector = (): ReactElement | null => {
  const weekStore = useWeekStore((state) => state);
  const resultText = useResultStore((state) => state.resultText);

  const weeks = useMemo(() => {
    const workWeeks: TimeRange[] = [];
    const now = new Date();

    let currentDate = new Date(now);

    currentDate = new Date(
      Date.UTC(
        currentDate.getUTCFullYear(),
        currentDate.getUTCMonth(),
        currentDate.getUTCDate(),
        0,
        0,
        0,
        0
      )
    );

    while (currentDate.getUTCDay() !== 5) {
      currentDate.setUTCDate(currentDate.getUTCDate() - 1);
    }

    currentDate = new Date(
      Date.UTC(
        currentDate.getUTCFullYear(),
        currentDate.getUTCMonth(),
        currentDate.getUTCDate(),
        22,
        0,
        0,
        0
      )
    );

    for (let i = 0; i < 20; i++) {
      const endDate = new Date(currentDate);

      const startDate = new Date(currentDate);
      while (startDate.getUTCDay() !== 1) {
        startDate.setUTCDate(startDate.getUTCDate() - 1);
      }

      startDate.setUTCHours(0, 0, 0, 0);

      workWeeks.push({
        from: new Date(startDate),
        to: new Date(endDate),
      });

      currentDate.setUTCDate(currentDate.getUTCDate() - 7);
    }

    return workWeeks;
  }, []);

  if (resultText) {
    return null;
  }

  const isSelected = (week: TimeRange) =>
    weekStore.weeks.some((w) => w.from === week.from);

  const toggleWeek = (week: TimeRange) => {
    weekStore.setWeeks(
      weekStore.weeks.some((w) => w.from === week.from)
        ? weekStore.weeks.filter((w) => w.from !== week.from)
        : [...weekStore.weeks, week]
    );
  };

  const formatDate = (date: Date) =>
    date.toISOString().split("T")[0].split("-").reverse().join(".");

  return (
    <div className={styles.container}>
      {weeks.map((week, index) => (
        <div
          className={classNames(styles.weekContainer, {
            [styles.selected]: isSelected(week),
          })}
          onClick={() => toggleWeek(week)}
          key={index}
        >
          <span>
            {formatDate(week.from)}-
            <br />
            {formatDate(week.to)}
          </span>
        </div>
      ))}
    </div>
  );
};

export default WeekSelector;
