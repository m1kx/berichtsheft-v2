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

    const currentWeekStart = new Date(now);
    while (currentWeekStart.getUTCDay() !== 1) {
      currentWeekStart.setUTCDate(currentWeekStart.getUTCDate() - 1);
    }
    currentWeekStart.setUTCHours(0, 0, 0, 0);
    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setUTCDate(currentWeekStart.getUTCDate() + 4);
    currentWeekEnd.setUTCHours(22, 0, 0, 0);

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

    workWeeks.unshift({
      from: new Date(currentWeekStart),
      to: new Date(currentWeekEnd),
    });

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

  const getWeekNumber = (week: TimeRange): number => {
    const baseDate = new Date(Date.UTC(2024, 6, 29, 0, 0, 0, 0));
    const diffInDays =
      (week.from.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24);
    const weekDiff = Math.floor(diffInDays / 7);
    return weekDiff + 1;
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
          <div className={styles.weekNumber}>{getWeekNumber(week)}</div>
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
