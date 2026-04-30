import type { ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type DashboardEmptyStateProps = {
  title: string;
  description: string;
  icon?: ReactNode;
};

export function DashboardEmptyState({ title, description, icon }: DashboardEmptyStateProps) {
  return (
    <Alert variant="clinical" className="flex items-start gap-3">
      {icon ? <div className="mt-0.5 text-primary">{icon}</div> : null}
      <div>
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{description}</AlertDescription>
      </div>
    </Alert>
  );
}
