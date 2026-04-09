import { useEffect, useState, useRef } from "react";
import { Award, Group, Votes } from "../types";
import { GROUPS, AWARDS, getAdjustedVotes, MAX_VOTERS } from "../lib/constants";
import { db, auth } from "../lib/firebase";
import { collection, onSnapshot, doc, writeBatch, setDoc, getDocs, increment } from "firebase/firestore";
import { motion, AnimatePresence } from "motion/react";
import { Users, Trophy, Play, Square, RotateCcw, X, PartyPopper } from "lucide-react";
import { cn } from "../lib/utils";
import confetti from "canvas-confetti";

export default function ResultsPage() {
  const [groups] = useState<Group[]>(GROUPS);
  const [awards] = useState<Award[]>(AWARDS);
  const [votes, setVotes] = useState<Votes>({});
  const [totalVoters, setTotalVoters] = useState<number>(0);
  const totalVotersRef = useRef<number>(0);
  const [isSimulating, setIsSimulating] = useState(false);
  
  // Modal state
  const [modalAction, setModalAction] = useState<"reset" | "simulate" | "ceremony" | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // Ceremony state
  const [ceremonyAwardIndex, setCeremonyAwardIndex] = useState<number | null>(null);

  // Simulation interval ref
  const simulationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Listen to votes
    const unsubscribeVotes = onSnapshot(collection(db, "votes"), (snapshot) => {
      const rawVotes: Votes = {};
      let maxTotal = 0;
      snapshot.forEach((doc) => {
        const data = doc.data();
        rawVotes[doc.id] = data;
        const currentAwardTotal = Object.values(data).reduce((a: any, b: any) => a + (typeof b === 'number' ? b : 0), 0);
        if (currentAwardTotal > maxTotal) {
          maxTotal = currentAwardTotal;
        }
      });
      const finalTotal = Math.min(maxTotal, MAX_VOTERS);
      setTotalVoters(finalTotal);
      totalVotersRef.current = finalTotal;
      setVotes(getAdjustedVotes(rawVotes));
    });

    // Listen to appState for simulation status
    const unsubscribeAppState = onSnapshot(doc(db, "appState", "config"), (doc) => {
      if (doc.exists()) {
        setIsSimulating(doc.data().isSimulating || false);
      }
    });

    return () => {
      unsubscribeVotes();
      unsubscribeAppState();
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
      }
    };
  }, []);

  const handleResetClick = () => {
    setModalAction("reset");
    setPassword("");
    setError("");
  };

  const handleSimulateClick = () => {
    setModalAction("simulate");
    setPassword("");
    setError("");
  };

  const handleCeremonyClick = () => {
    setModalAction("ceremony");
    setPassword("");
    setError("");
  };

  const confirmAction = async () => {
    if (password === "asdadmin") {
      if (modalAction === "reset") {
        try {
          const batch = writeBatch(db);
          const votesSnapshot = await getDocs(collection(db, "votes"));
          votesSnapshot.forEach((doc) => {
            batch.delete(doc.ref);
          });
          await batch.commit();
          
          if (isSimulating) {
            await setDoc(doc(db, "appState", "config"), { isSimulating: false }, { merge: true });
          }
        } catch (err) {
          console.error("Error resetting votes:", err);
        }
      } else if (modalAction === "simulate") {
        try {
          const newSimulatingState = !isSimulating;
          await setDoc(doc(db, "appState", "config"), { isSimulating: newSimulatingState }, { merge: true });
          
          if (newSimulatingState) {
            // Start simulation locally for the admin
            if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);
            
            // Reset votes before starting
            const batch = writeBatch(db);
            const votesSnapshot = await getDocs(collection(db, "votes"));
            votesSnapshot.forEach((doc) => {
              batch.delete(doc.ref);
            });
            await batch.commit();

            simulationIntervalRef.current = setInterval(async () => {
              if (totalVotersRef.current >= MAX_VOTERS) {
                if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);
                await setDoc(doc(db, "appState", "config"), { isSimulating: false }, { merge: true });
                return;
              }
              try {
                const simBatch = writeBatch(db);
                AWARDS.forEach((award) => {
                  const numVotes = Math.floor(Math.random() * 3) + 1;
                  for (let i = 0; i < numVotes; i++) {
                    const randomGroup = GROUPS[Math.floor(Math.random() * GROUPS.length)];
                    const voteRef = doc(db, "votes", award.id);
                    simBatch.set(voteRef, { [randomGroup.id]: increment(1) }, { merge: true });
                  }
                });
                await simBatch.commit();
              } catch (e) {
                console.error("Simulation error", e);
              }
            }, 800);
          } else {
            // Stop simulation
            if (simulationIntervalRef.current) {
              clearInterval(simulationIntervalRef.current);
              simulationIntervalRef.current = null;
            }
          }
        } catch (err) {
          console.error("Error toggling simulation:", err);
        }
      } else if (modalAction === "ceremony") {
        setCeremonyAwardIndex(0);
        triggerConfetti();
      }
      setModalAction(null);
    } else {
      setError("Incorrect password");
    }
  };

  const triggerConfetti = () => {
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 200 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti({
        ...defaults, particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults, particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);
  };

  const nextCeremonyAward = () => {
    if (ceremonyAwardIndex !== null && ceremonyAwardIndex < awards.length - 1) {
      setCeremonyAwardIndex(ceremonyAwardIndex + 1);
      triggerConfetti();
    } else {
      setCeremonyAwardIndex(null);
    }
  };

  if (awards.length === 0 || groups.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  // Render Ceremony Overlay
  if (ceremonyAwardIndex !== null) {
    const award = awards[ceremonyAwardIndex];
    const awardVotes = votes[award.id] || {};
    const sortedGroups = [...groups].sort((a, b) => {
      const votesA = awardVotes[a.id] || 0;
      const votesB = awardVotes[b.id] || 0;
      return votesB - votesA;
    });
    const winner = sortedGroups[0];

    return (
      <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-zinc-900 text-white overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/50 via-purple-900/50 to-zinc-900/50" />
        
        <motion.div 
          key={award.id}
          initial={{ opacity: 0, scale: 0.8, y: 50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", bounce: 0.4, duration: 1 }}
          className="relative z-10 flex flex-col items-center text-center px-4"
        >
          <motion.div
            initial={{ rotate: -180, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            transition={{ delay: 0.3, type: "spring" }}
            className="mb-8 p-6 bg-yellow-500/20 rounded-full ring-4 ring-yellow-500/50"
          >
            <Trophy size={80} className="text-yellow-400" />
          </motion.div>
          
          <h2 className="text-3xl md:text-5xl font-bold text-yellow-400 mb-4 tracking-tight">
            {award.name}
          </h2>
          
          <p className="text-xl md:text-2xl text-zinc-300 mb-12">
            And the winner is...
          </p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5, duration: 0.8 }}
            className="flex flex-col items-center"
          >
            <img 
              src={winner.imageUrl} 
              alt={winner.name}
              className="w-48 h-48 md:w-64 md:h-64 rounded-full object-cover border-8 border-white shadow-2xl mb-8"
            />
            <h1 className="text-5xl md:text-7xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-300 drop-shadow-lg">
              {winner.name}
            </h1>
          </motion.div>
        </motion.div>

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 3 }}
          onClick={nextCeremonyAward}
          className="absolute bottom-12 z-20 px-8 py-4 bg-white text-zinc-900 rounded-full font-bold text-lg hover:bg-zinc-100 transition-colors shadow-xl"
        >
          {ceremonyAwardIndex < awards.length - 1 ? "Next Award" : "Finish Ceremony"}
        </motion.button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-8 text-zinc-900 sm:px-6 lg:px-8 overflow-x-hidden">
      {/* Password Modal */}
      <AnimatePresence>
        {modalAction !== null && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-zinc-900">
                  {modalAction === "reset" ? "Reset Votes" : modalAction === "simulate" ? (isSimulating ? "Stop Simulation" : "Start Simulation") : "Award Ceremony"}
                </h3>
                <button
                  onClick={() => setModalAction(null)}
                  className="rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <p className="text-zinc-600 mb-4">
                {modalAction === "reset" 
                  ? "Enter the admin password to reset all votes. This action cannot be undone."
                  : modalAction === "simulate" 
                  ? "Enter the admin password to toggle the live voting simulation."
                  : "Enter the admin password to start the award ceremony."}
              </p>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && confirmAction()}
                placeholder="Enter password..."
                className={cn(
                  "w-full rounded-xl border px-4 py-3 outline-none transition-all focus:ring-2",
                  error ? "border-red-300 focus:border-red-500 focus:ring-red-200" : "border-zinc-200 focus:border-indigo-500 focus:ring-indigo-200"
                )}
                autoFocus
              />
              {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setModalAction(null)}
                  className="rounded-xl px-4 py-2 font-medium text-zinc-600 hover:bg-zinc-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmAction}
                  className={cn(
                    "rounded-xl px-4 py-2 font-medium text-white transition-colors",
                    modalAction === "reset" || (modalAction === "simulate" && isSimulating) ? "bg-red-600 hover:bg-red-700" : "bg-indigo-600 hover:bg-indigo-700"
                  )}
                >
                  {modalAction === "reset" ? "Reset All" : "Confirm"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="absolute top-4 right-4 sm:top-8 sm:right-8 z-50 flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleResetClick}
          className="flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all shadow-sm border bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"
        >
          <RotateCcw size={16} />
          Reset Votes
        </button>
        <button
          onClick={handleSimulateClick}
          className={cn(
            "flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all shadow-sm border",
            isSimulating
              ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
              : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"
          )}
        >
          {isSimulating ? <Square size={16} /> : <Play size={16} />}
          {isSimulating ? "Stop Simulation" : "Simulate Live Voting"}
        </button>
      </div>

      <div className="mx-auto max-w-7xl">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-zinc-900">
            即時投票結果
          </h1>
          <p className="mt-2 text-lg text-zinc-600">
            一起來幫您心中的得獎者加油！
          </p>
        </div>

        {/* Dense Grid Layout for Desktop */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {awards.map((award, index) => {
            const awardVotes = votes[award.id] || {};
            const maxVotes = Math.max(...(Object.values(awardVotes) as number[]), 1);
            
            // Sort groups by votes descending and take only top 3
            const sortedGroups = [...groups].sort((a, b) => {
              const votesA = awardVotes[a.id] || 0;
              const votesB = awardVotes[b.id] || 0;
              return votesB - votesA;
            }).slice(0, 3);

            return (
              <motion.div
                key={award.id}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: index * 0.1 }}
                className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-lg shadow-zinc-200/50 flex flex-col"
              >
                <div className="border-b border-zinc-100 bg-zinc-50/80 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2 truncate">
                      <Trophy className="text-yellow-500 shrink-0" size={18} />
                      <span className="truncate">{award.name}</span>
                    </h2>
                    <div className="flex items-center gap-1.5 rounded-full bg-white px-2 py-0.5 text-xs font-medium text-zinc-600 border border-zinc-200 shadow-sm shrink-0">
                      <Users size={12} />
                      <span>{totalVoters}</span>
                    </div>
                  </div>
                </div>
                <div className="p-4 flex-1 flex flex-col justify-center gap-4 min-h-[220px]">
                  <AnimatePresence mode="popLayout">
                    {sortedGroups.map((group, groupIndex) => {
                      const groupVotes = awardVotes[group.id] || 0;
                      const racePercentage = Math.max((groupVotes / maxVotes) * 100, 15);
                      const isLeader = groupIndex === 0 && groupVotes > 0;
                      
                      return (
                        <motion.div
                          key={group.id}
                          layout
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{
                            layout: { type: "spring", stiffness: 300, damping: 30 },
                            opacity: { duration: 0.2 }
                          }}
                          className="relative w-full"
                        >
                          <div className="mb-1.5 flex items-center justify-between text-xs">
                            <span className={cn("font-semibold truncate pr-2", isLeader ? "text-indigo-700" : "text-zinc-700")}>
                              {group.name}
                            </span>
                            <span className="font-mono font-bold text-zinc-500 shrink-0">
                              {groupVotes} pts
                            </span>
                          </div>
                          
                          {/* Race Track */}
                          <div className="relative h-10 w-full rounded-full bg-zinc-100 border border-zinc-200 shadow-inner overflow-visible">
                            <div className="absolute right-3 top-0 bottom-0 w-1 border-r-2 border-dashed border-zinc-300 opacity-50" />
                            
                            <motion.div
                              initial={{ width: "15%" }}
                              animate={{ width: `${racePercentage}%` }}
                              transition={{ type: "spring", bounce: 0.2, duration: 1 }}
                              className={cn(
                                "absolute left-0 top-0 bottom-0 rounded-full flex items-center justify-end pr-1 transition-colors",
                                isLeader ? "bg-gradient-to-r from-indigo-400 to-indigo-600 shadow-md" : "bg-gradient-to-r from-zinc-300 to-zinc-400"
                              )}
                            >
                              <div className="relative">
                                <img
                                  src={group.imageUrl}
                                  alt={group.name}
                                  className={cn(
                                    "h-8 w-8 rounded-full object-cover border-2 bg-white z-10 relative",
                                    isLeader ? "border-indigo-100 shadow-lg" : "border-white shadow-sm"
                                  )}
                                />
                                {isLeader && (
                                  <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="absolute -top-1.5 -right-1.5 bg-yellow-400 text-yellow-900 rounded-full p-0.5 shadow-sm z-20"
                                  >
                                    <Trophy size={10} />
                                  </motion.div>
                                )}
                              </div>
                            </motion.div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Award Ceremony Button */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-12 flex justify-center pb-12"
        >
          <button
            onClick={handleCeremonyClick}
            className="group relative flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 px-10 py-5 text-xl font-bold text-white shadow-xl transition-all hover:scale-105 hover:shadow-2xl hover:from-indigo-500 hover:to-purple-500"
          >
            <PartyPopper size={28} className="animate-bounce" />
            <span>Start Award Ceremony</span>
          </button>
        </motion.div>
      </div>
    </div>
  );
}
