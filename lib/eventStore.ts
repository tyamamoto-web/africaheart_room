"use client";

import { defaultMembers, defaultRotations, type Member } from "./data";

export type RoomKey = "A" | "B" | "C";

export type EventSetup = {
  attendanceIds: string[];
  rotations: Record<string, Record<string, RoomKey>>;
};

const STORAGE_KEY = "africaheart_event_v3";

function defaultSetup(): EventSetup {
  return {
    attendanceIds: defaultMembers.map((m) => m.id),
    rotations: defaultRotations,
  };
}

export function getEventSetup(): EventSetup {
  if (typeof window === "undefined") return defaultSetup();
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return defaultSetup();
}

export function saveEventSetup(setup: EventSetup): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(setup));
}

export function setAttendance(ids: string[]): void {
  saveEventSetup({ ...getEventSetup(), attendanceIds: ids });
}

export function setMemberRoom(
  slotId: string,
  memberId: string,
  room: RoomKey | null
): void {
  const setup = getEventSetup();
  const slot = { ...(setup.rotations[slotId] ?? {}) };
  if (room === null) {
    delete slot[memberId];
  } else {
    slot[memberId] = room;
  }
  saveEventSetup({
    ...setup,
    rotations: { ...setup.rotations, [slotId]: slot },
  });
}

export function getRotationGroups(
  slotId: string,
  members: Member[]
): { A: Member[]; B: Member[]; C: Member[]; unassigned: Member[] } {
  const setup = getEventSetup();
  const attending = new Set(setup.attendanceIds);
  const assignments = setup.rotations[slotId] ?? {};
  const result: { A: Member[]; B: Member[]; C: Member[]; unassigned: Member[] } =
    { A: [], B: [], C: [], unassigned: [] };

  for (const m of members) {
    if (!attending.has(m.id)) continue;
    const room = assignments[m.id];
    if (room === "A" || room === "B" || room === "C") {
      result[room].push(m);
    } else {
      result.unassigned.push(m);
    }
  }
  return result;
}
