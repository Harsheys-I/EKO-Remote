import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) { return <section className={`panel ${className}`}>{children}</section>; }
export function SectionHeading({ kicker, title, action }: { kicker: string; title: string; action?: ReactNode }) { return <div className="section-heading"><div><span className="eyebrow">{kicker}</span><h2>{title}</h2></div>{action}</div>; }
export function Metric({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value: string; detail?: string }) { return <article className="metric"><span><Icon size={18} /></span><div><small>{label}</small><strong>{value}</strong>{detail && <em>{detail}</em>}</div></article>; }
export function Toggle({ checked, label, description, disabled, onChange }: { checked: boolean; label: string; description?: string; disabled?: boolean; onChange: (value: boolean) => void }) { return <label className={`toggle ${disabled ? "disabled" : ""}`}><div><strong>{label}</strong>{description && <span>{description}</span>}</div><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} /><i /></label>; }
export function EmptyState({ icon: Icon, title, message }: { icon: LucideIcon; title: string; message: string }) { return <div className="empty-state"><Icon size={28} /><strong>{title}</strong><p>{message}</p></div>; }
