export const OTHER_OPTION = "Other (type your own)";
const RECOMMENDED_OPTION_TAG = " (Recommended)";

export interface AskOption {
  label: string;
}

export interface AskQuestion {
  id: string;
  question: string;
  markdownCtx: string;
  options: AskOption[];
  multi: boolean;
  recommended: number;
}

export interface AskSelection {
  selectedOptions: string[];
  customInput?: string;
}

export type SelectionDisplayStyle = "session" | "review";

/**
 * Format a selection for display. The `session` style feeds the LLM session
 * text (quoted custom input, `(cancelled)` for empty); the `review` style
 * feeds the Submit review tab (`Other:` prefix, `(not answered)` for empty).
 */
export function formatSelection(
  result: Pick<AskSelection, "selectedOptions" | "customInput"> & { multi: boolean },
  style: SelectionDisplayStyle,
): string {
  const hasSelectedOptions = result.selectedOptions.length > 0;
  const hasCustomInput = Boolean(result.customInput);

  if (!hasSelectedOptions && !hasCustomInput) {
    return style === "session" ? "(cancelled)" : "(not answered)";
  }

  const quote = (text: string) => (style === "session" ? `"${text}"` : text);

  if (hasSelectedOptions && hasCustomInput) {
    const selectedPart = result.multi
      ? `[${result.selectedOptions.join(", ")}]`
      : result.selectedOptions[0];
    return `${selectedPart} + Other: ${quote(result.customInput as string)}`;
  }

  if (hasCustomInput) {
    return style === "session"
      ? quote(result.customInput as string)
      : `Other: ${result.customInput}`;
  }

  if (result.multi) {
    return `[${result.selectedOptions.join(", ")}]`;
  }

  return result.selectedOptions[0] as string;
}

export function appendRecommendedTagToOptionLabels(
  optionLabels: string[],
  recommendedOptionIndex?: number,
): string[] {
  if (
    recommendedOptionIndex == null ||
    recommendedOptionIndex < 0 ||
    recommendedOptionIndex >= optionLabels.length
  ) {
    return optionLabels;
  }

  return optionLabels.map((optionLabel, optionIndex) => {
    if (optionIndex !== recommendedOptionIndex) return optionLabel;
    if (optionLabel.endsWith(RECOMMENDED_OPTION_TAG)) return optionLabel;
    return `${optionLabel}${RECOMMENDED_OPTION_TAG}`;
  });
}

function removeRecommendedTagFromOptionLabel(optionLabel: string): string {
  if (!optionLabel.endsWith(RECOMMENDED_OPTION_TAG)) {
    return optionLabel;
  }
  return optionLabel.slice(0, -RECOMMENDED_OPTION_TAG.length);
}

export function buildSingleSelectionResult(
  selectedOptionLabel: string,
  note?: string,
): AskSelection {
  const normalizedSelectedOption = removeRecommendedTagFromOptionLabel(selectedOptionLabel);
  const normalizedNote = note?.trim();

  if (normalizedSelectedOption === OTHER_OPTION) {
    if (normalizedNote) {
      return { selectedOptions: [], customInput: normalizedNote };
    }
    return { selectedOptions: [] };
  }

  if (normalizedNote) {
    return {
      selectedOptions: [`${normalizedSelectedOption} - ${normalizedNote}`],
    };
  }

  return { selectedOptions: [normalizedSelectedOption] };
}

export function buildMultiSelectionResult(
  optionLabels: string[],
  selectedOptionIndexes: number[],
  optionNotes: string[],
  otherOptionIndex: number,
): AskSelection {
  const selectedOptionSet = new Set(selectedOptionIndexes);
  const selectedOptions: string[] = [];
  let customInput: string | undefined;

  for (let optionIndex = 0; optionIndex < optionLabels.length; optionIndex++) {
    if (!selectedOptionSet.has(optionIndex)) continue;

    const optionLabel = removeRecommendedTagFromOptionLabel(optionLabels[optionIndex]);
    const optionNote = optionNotes[optionIndex]?.trim();

    if (optionIndex === otherOptionIndex) {
      if (optionNote) customInput = optionNote;
      continue;
    }

    if (optionNote) {
      selectedOptions.push(`${optionLabel} - ${optionNote}`);
    } else {
      selectedOptions.push(optionLabel);
    }
  }

  if (customInput) {
    return { selectedOptions, customInput };
  }

  return { selectedOptions };
}
