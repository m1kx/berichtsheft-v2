import ActionButtons from "@/components/ActionButtons";
import ResultField from "@/components/ResultField";
import WeekSelector from "@/components/WeekSelector";
import styles from "./page.module.scss";

export default function Home() {
  return (
    <div className={styles.page}>
      <WeekSelector />
      <ResultField />
      <ActionButtons />
    </div>
  );
}
