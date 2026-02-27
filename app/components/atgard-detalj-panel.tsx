"use client";

import type { ComponentProps } from "react";
import { BrfActionDetailsEditor } from "./brf-action-details-editor";

export function AtgardDetaljPanel(props: ComponentProps<typeof BrfActionDetailsEditor>) {
  return <BrfActionDetailsEditor {...props} />;
}
