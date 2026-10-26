import type { OpenDevelopmentDialog } from "../../data/site";
import { AnimalAdCreatePage } from "./AnimalAdCreatePage";

interface AdEditPageProps {
  onOpenDialog?: OpenDevelopmentDialog;
}

export function AdEditPage({ onOpenDialog }: AdEditPageProps) {
  return <AnimalAdCreatePage mode="edit" onOpenDialog={onOpenDialog} />;
}
