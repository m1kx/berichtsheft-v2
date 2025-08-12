import ActionButtons from "@/components/ActionButtons";
import LogDisplay from "@/components/LogDisplay";
import ResultField from "@/components/ResultField";
import WeekSelector from "@/components/WeekSelector";
import styles from "./page.module.scss";

export default function Home() {
  return (
    <div className={styles.page}>
      <WeekSelector />
      <ResultField />
      <LogDisplay />
      <ActionButtons />
    </div>
  );
}
