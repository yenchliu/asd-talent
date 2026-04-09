export const GROUPS = [
  { id: "g1", name: "The Greatest Showman", imageUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&q=80&w=200&h=200" },
  { id: "g2", name: "沉默是金", imageUrl: "https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?auto=format&fit=crop&q=80&w=200&h=200" },
  { id: "g3", name: "ASD男孩", imageUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=200&h=200" },
  { id: "g4", name: "自彈自唱", imageUrl: "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?auto=format&fit=crop&q=80&w=200&h=200" },
  { id: "g5", name: "ASD舞力全開", imageUrl: "https://images.unsplash.com/photo-1547153760-18fc86324498?auto=format&fit=crop&q=80&w=200&h=200" },
  { id: "g6", name: "串燒歌曲", imageUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&q=80&w=200&h=200" },
  { id: "g7", name: "Rolling in the Deep", imageUrl: "https://images.unsplash.com/photo-1516280440502-a2fc69a16bf8?auto=format&fit=crop&q=80&w=200&h=200" },
];

export const AWARDS = [
  { id: "a1", name: "狂野音浪，炸裂全場獎" },
  { id: "a2", name: "吉他詩人，才華橫溢獎" },
  { id: "a3", name: "青春男女，最佳活力獎" },
  { id: "a4", name: "律動全球，聽覺盛宴獎" },
  { id: "a5", name: "琴瑟合鳴，藝境巔峰獎" },
  { id: "a6", name: "時代金曲，傳奇演繹獎" },
  { id: "a7", name: "三維鼎立，聲動天籟獎" },
];

// Helper to calculate adjusted votes guaranteeing unique winners
export function getAdjustedVotes(rawVotes: Record<string, Record<string, number>>) {
  const pairs: { awardId: string; groupId: string; votes: number }[] = [];
  
  for (const a of AWARDS) {
    for (const g of GROUPS) {
      pairs.push({
        awardId: a.id,
        groupId: g.id,
        votes: rawVotes[a.id]?.[g.id] || 0,
      });
    }
  }

  // Sort descending by votes. Use IDs as tie-breaker for stability.
  pairs.sort((a, b) => {
    if (b.votes !== a.votes) return b.votes - a.votes;
    return (a.awardId + a.groupId).localeCompare(b.awardId + b.groupId);
  });

  const assignedAwards = new Set<string>();
  const assignedGroups = new Set<string>();
  const winners: Record<string, string> = {};

  for (const pair of pairs) {
    if (!assignedAwards.has(pair.awardId) && !assignedGroups.has(pair.groupId)) {
      winners[pair.awardId] = pair.groupId;
      assignedAwards.add(pair.awardId);
      assignedGroups.add(pair.groupId);
    }
  }

  // Fill remaining (if any)
  const unassignedAwards = AWARDS.map(a => a.id).filter(id => !assignedAwards.has(id));
  const unassignedGroups = GROUPS.map(g => g.id).filter(id => !assignedGroups.has(id));
  for (let i = 0; i < unassignedAwards.length; i++) {
    winners[unassignedAwards[i]] = unassignedGroups[i];
  }

  // Create adjusted votes
  const adjustedVotes: Record<string, Record<string, number>> = JSON.parse(JSON.stringify(rawVotes));

  for (const a of AWARDS) {
    const aId = a.id;
    if (!adjustedVotes[aId]) adjustedVotes[aId] = {};
    
    const totalRaw = Object.values(rawVotes[aId] || {}).reduce((sum, val) => sum + val, 0);
    if (totalRaw === 0) continue; // Don't adjust if no votes at all

    const winnerId = winners[aId];
    let maxOther = 0;
    
    for (const g of GROUPS) {
      if (g.id !== winnerId) {
        const v = adjustedVotes[aId][g.id] || 0;
        if (v > maxOther) maxOther = v;
      }
    }

    const currentWinnerVotes = adjustedVotes[aId][winnerId] || 0;
    if (currentWinnerVotes <= maxOther) {
      // Boost winner to be strictly greater than maxOther
      // Add a small pseudo-random margin based on maxOther to look natural
      const margin = 1 + (maxOther % 3); 
      adjustedVotes[aId][winnerId] = maxOther + margin;
    }
  }

  return adjustedVotes;
}
