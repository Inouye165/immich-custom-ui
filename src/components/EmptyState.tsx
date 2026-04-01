import styles from './EmptyState.module.css';

interface EmptyStateProps {
  message: string;
}

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className={styles.empty} role="status">
      <p>{message}</p>
    </div>
  );
}
