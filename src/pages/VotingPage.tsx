import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Award, Group } from "../types";
import { GROUPS, AWARDS } from "../lib/constants";
import { db, auth } from "../lib/firebase";
import { doc, runTransaction, increment } from "firebase/firestore";
import { cn } from "../lib/utils";
import { Send, Trophy, GripVertical } from "lucide-react";
import { motion } from "motion/react";
import {
  DndContext,
  DragEndEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  DragOverlay,
} from "@dnd-kit/core";

const DraggableGroup: React.FC<{ group: Group; className?: string }> = ({ group, className }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: group.id,
    data: group,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "relative flex items-center gap-2 lg:gap-3 rounded-xl border bg-white p-2 lg:p-3 text-left shadow-sm transition-all touch-none select-none",
        isDragging ? "opacity-50 ring-2 ring-indigo-500" : "border-zinc-200 hover:border-indigo-300 hover:shadow-md cursor-grab active:cursor-grabbing",
        className
      )}
    >
      <div className="flex items-center justify-center text-zinc-400 shrink-0">
        <GripVertical size={18} className="lg:w-5 lg:h-5" />
      </div>
      <img
        src={group.imageUrl}
        alt={group.name}
        referrerPolicy="no-referrer"
        className="h-10 w-10 lg:h-12 lg:w-12 rounded-full object-cover border border-zinc-100 pointer-events-none shrink-0"
      />
      <div className="flex flex-col min-w-0 pointer-events-none">
        <span className="font-bold text-sm lg:text-base text-zinc-900 truncate tracking-tight">{group.name}</span>
        {group.subName && (
          <span className="text-[10px] lg:text-xs text-zinc-500 truncate leading-tight">{group.subName}</span>
        )}
      </div>
    </div>
  );
}

const DroppableAward: React.FC<{
  award: Award;
  assignedGroup: Group | null;
}> = ({
  award,
  assignedGroup,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `award-${award.id}`,
    data: { type: "award", awardId: award.id },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "overflow-hidden rounded-2xl border transition-all duration-200 h-full flex flex-col",
        isOver ? "border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-500" : "border-zinc-200 bg-white"
      )}
    >
      <div className="border-b border-zinc-100 bg-zinc-50/50 px-4 py-3">
        <h2 className="text-base font-semibold text-zinc-900">{award.name}</h2>
      </div>
      <div className="p-3 flex-1 flex flex-col justify-center min-h-[88px]">
        {assignedGroup ? (
          <DraggableGroup group={assignedGroup} />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50/50 p-4 text-center text-sm text-zinc-400">
            Drag a group here
          </div>
        )}
      </div>
    </div>
  );
}

export default function VotingPage() {
  const [groups, setGroups] = useState<Group[]>(GROUPS);
  const [awards, setAwards] = useState<Award[]>(AWARDS);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const navigate = useNavigate();

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 5,
      },
    })
  );

  useEffect(() => {
    // Config is now loaded from constants
  }, []);

  const handleDragStart = (event: any) => {
    const { active } = event;
    const group = groups.find((g) => g.id === active.id);
    if (group) setActiveGroup(group);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveGroup(null);

    if (!over) return;

    const groupId = active.id as string;
    const overId = over.id as string;

    setSelections((prev) => {
      const next = { ...prev };

      // Remove the group from its previous award slot if it was in one
      for (const [aId, gId] of Object.entries(next)) {
        if (gId === groupId) {
          delete next[aId];
        }
      }

      // If dropped on an award slot
      if (overId.startsWith("award-")) {
        const awardId = overId.replace("award-", "");
        next[awardId] = groupId;
      }

      return next;
    });
  };

  const handleSubmit = async () => {
    if (Object.keys(selections).length !== awards.length) {
      alert("Please select a group for all awards before submitting.");
      return;
    }

    if (!auth.currentUser) {
      alert("Please wait for authentication to complete.");
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Submit votes using transactions or batch writes
      for (const entry of Object.entries(selections)) {
        const awardId = entry[0];
        const gId = entry[1] as string;
        const voteRef = doc(db, "votes", awardId);
        await runTransaction(db, async (transaction) => {
          const voteDoc = await transaction.get(voteRef);
          if (!voteDoc.exists()) {
            transaction.set(voteRef, { [gId]: 1 });
          } else {
            transaction.update(voteRef, { [gId]: increment(1) });
          }
        });
      }
      navigate("/results");
    } catch (error) {
      console.error("Error submitting votes:", error);
      alert("Failed to submit votes. Please try again.");
      setIsSubmitting(false);
    }
  };

  const { setNodeRef: setPoolRef, isOver: isPoolOver } = useDroppable({
    id: "pool",
  });

  if (awards.length === 0 || groups.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-900 border-t-transparent"></div>
      </div>
    );
  }

  const unassignedGroups = groups.filter(
    (g) => !Object.values(selections).includes(g.id)
  );

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="min-h-screen bg-zinc-50 px-4 py-8 sm:px-6 lg:px-8 pb-48 lg:pb-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8 text-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-indigo-600"
            >
              <Trophy size={32} />
            </motion.div>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent drop-shadow-sm pb-2">
              ASD's Got Talent
            </h1>
            <p className="mt-3 text-zinc-600">
              請將表演組合拖曳至獎項內進行投票並按送出
            </p>
          </div>

          <div className="flex flex-col-reverse lg:grid lg:grid-cols-12 gap-8">
            {/* Available Groups Pool */}
            <div className="lg:col-span-4 fixed bottom-0 left-0 right-0 z-40 lg:relative lg:bottom-auto lg:left-auto lg:right-auto lg:z-auto">
              <div
                ref={setPoolRef}
                className={cn(
                  "lg:sticky lg:top-8 transition-all",
                  "border-t lg:border rounded-t-2xl lg:rounded-2xl p-4 lg:p-6",
                  isPoolOver ? "border-indigo-300 bg-indigo-50/95" : "border-zinc-300 bg-zinc-100/95 backdrop-blur-md lg:bg-white lg:border-zinc-200",
                  "lg:min-h-[300px] shadow-[0_-8px_30px_rgba(0,0,0,0.12)] lg:shadow-none"
                )}
              >
                <h3 className="mb-3 lg:mb-4 text-sm lg:text-lg font-semibold text-zinc-900 flex items-center justify-between">
                  <span>Available Groups</span>
                  <span className="lg:hidden text-xs font-normal text-zinc-500 bg-zinc-100 px-2 py-1 rounded-full">Swipe & Drag</span>
                </h3>
                <div className="flex flex-row lg:flex-col gap-3 overflow-x-auto pb-2 lg:pb-0 snap-x">
                  {unassignedGroups.length > 0 ? (
                    unassignedGroups.map((group: Group) => (
                      <DraggableGroup key={group.id} group={group} className="snap-start shrink-0 w-48 lg:w-auto" />
                    ))
                  ) : (
                    <div className="flex h-16 lg:h-32 w-full items-center justify-center rounded-xl border-2 border-dashed border-zinc-200 text-sm text-zinc-400 shrink-0">
                      All groups assigned!
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Awards Slots */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              <div className="grid gap-4 sm:grid-cols-2">
                {awards.map((award, index) => {
                  const assignedGroupId = selections[award.id];
                  const assignedGroup = groups.find((g) => g.id === assignedGroupId) || null;

                  return (
                    <motion.div
                      key={award.id}
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: index * 0.1 }}
                      className={index === awards.length - 1 && awards.length % 2 !== 0 ? "sm:col-span-2" : ""}
                    >
                      <DroppableAward award={award} assignedGroup={assignedGroup} />
                    </motion.div>
                  );
                })}
              </div>

              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: awards.length * 0.1 + 0.2 }}
                className="pt-2"
              >
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || Object.keys(selections).length !== awards.length}
                  className="group relative flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-8 py-4 text-lg font-semibold text-white transition-all hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  ) : (
                    <>
                      <span>Submit Votes</span>
                      <Send size={20} className="transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </button>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeGroup ? (
          <div className="relative flex items-center gap-3 rounded-xl border border-indigo-500 bg-white p-3 text-left shadow-xl opacity-90 scale-105">
            <div className="flex items-center justify-center text-zinc-400">
              <GripVertical size={20} />
            </div>
            <img
              src={activeGroup.imageUrl}
              alt={activeGroup.name}
              referrerPolicy="no-referrer"
              className="h-12 w-12 rounded-full object-cover border border-zinc-100"
            />
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-zinc-900 leading-tight">{activeGroup.name}</span>
              {activeGroup.subName && (
                <span className="text-xs text-zinc-500">{activeGroup.subName}</span>
              )}
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
