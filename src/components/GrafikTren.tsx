"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { WARNA_SENTIMEN } from "@/lib/format";

export type TitikTren = { label: string; positif: number; netral: number; negatif: number };

export default function GrafikTren({ data, tinggi = 240 }: { data: TitikTren[]; tinggi?: number | `${number}%` }) {
  return (
    <ResponsiveContainer width="100%" height={tinggi}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke="#eef2f6" strokeDasharray="4 4" />
        <XAxis dataKey="label" tick={{ fontSize: 11.5, fill: "#5b6b7c" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis allowDecimals={false} tick={{ fontSize: 11.5, fill: "#5b6b7c" }} tickLine={false} axisLine={false} />
        <Tooltip cursor={{ fill: "rgba(47,102,144,0.06)", radius: 6 }} contentStyle={{ borderRadius: 12, border: "1px solid #e5eaf0", fontSize: 12.5, boxShadow: "0 10px 30px -12px rgb(16 24 40 / 0.25)" }} labelFormatter={(l) => `Minggu mulai ${l}`} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12.5, paddingTop: 8 }} formatter={(v) => <span style={{ color: "#3b4a59" }}>{v}</span>} />
        <Bar dataKey="negatif" name="Negatif" stackId="s" fill={WARNA_SENTIMEN.negatif} isAnimationActive={false} />
        <Bar dataKey="netral" name="Netral" stackId="s" fill="#ced4da" isAnimationActive={false} />
        <Bar dataKey="positif" name="Positif" stackId="s" fill={WARNA_SENTIMEN.positif} radius={[6, 6, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
