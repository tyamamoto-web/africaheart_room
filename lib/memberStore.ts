"use client";

import { Member, defaultMembers } from "./data";

const STORAGE_KEY = "africaheart_members_v2";

export function getMembers(): Member[] {
  if (typeof window === "undefined") return defaultMembers;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return defaultMembers;
}

export function saveMembers(members: Member[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(members));
}

export function addMember(data: Omit<Member, "id">): Member {
  const members = getMembers();
  const newMember: Member = { ...data, id: Date.now().toString() };
  saveMembers([...members, newMember]);
  return newMember;
}

export function updateMember(id: string, data: Partial<Omit<Member, "id">>): void {
  saveMembers(getMembers().map((m) => (m.id === id ? { ...m, ...data } : m)));
}

export function deleteMember(id: string): void {
  saveMembers(getMembers().filter((m) => m.id !== id));
}

export function resetToDefault(): void {
  saveMembers(defaultMembers);
}
