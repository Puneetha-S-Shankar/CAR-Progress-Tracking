"use client";
import { useEffect } from "react";
import { IconCheck, IconX, IconDiamond } from "./Icons";

export type ToastType = "accent" | "success" | "error";

export interface ToastData {
  message: string;
  type: ToastType;
}

export default function Toast({
  message,
  type = "accent",
  duration = 3600,
  onDone,
}: {
  message: string;
  type?: ToastType;
  duration?: number;
  onDone: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDone, duration);
    return () => clearTimeout(t);
  }, [onDone, duration]);

  const icon =
    type === "success" ? <IconCheck size={12} /> : type === "error" ? <IconX size={12} /> : <IconDiamond size={11} />;

  return (
    <div className={`toast toast-${type}`}>
      <div className="toast-icon">{icon}</div>
      <span>{message}</span>
    </div>
  );
}
