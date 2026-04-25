import { toast } from "sonner";

export const successToasts = {
  flashcardReviewed: (remaining: number) => {
    if (remaining <= 0) {
      toast.success("Review complete", {
        description: "All due cards for today are done.",
        duration: 3500,
      });
      return;
    }

    toast.success("Card reviewed", {
      description: `${remaining} cards remaining`,
      duration: 2000,
    });
  },

  examSubmitted: (score: number) => {
    toast.success("Exam submitted", {
      description: `Score: ${Math.round(score)}%`,
      duration: 3500,
    });
  },

  importComplete: (stats: { questions: number; flashcards: number; notes: number }) => {
    toast.success("Import completed", {
      description: `${stats.notes} notes, ${stats.questions} questions, ${stats.flashcards} flashcards`,
      duration: 4500,
    });
  },

  taskCompleted: () => {
    toast.success("Task completed", { duration: 1500 });
  },
};

export const errorToasts = {
  generic: (message?: string) => {
    toast.error("Something went wrong", {
      description: message || "Please try again.",
      duration: 4500,
    });
  },

  saveFailed: () => {
    toast.error("Save failed", {
      description: "Your changes were not saved. Please try again.",
      duration: 4500,
    });
  },

  networkError: () => {
    toast.error("Network error", {
      description: "Check your connection and try again.",
      duration: 5000,
    });
  },
};
