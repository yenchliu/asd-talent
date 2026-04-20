export const GROUPS = [
  { id: "g1", name: "The Dreamers", subName: "Violin Trio & Pianist", imageUrl: "https://loremflickr.com/200/200/violin,pianist,quartet?lock=1" },
  { id: "g2", name: "Soul Brothers", subName: "2 Men Singing", imageUrl: "https://loremflickr.com/200/200/singing,men,duet?lock=1" },
  { id: "g3", name: "ASD Boys", subName: "熱情森巴舞", imageUrl: "https://loremflickr.com/200/200/choir,men?lock=1" },
  { id: "g4", name: "Lonely Poet", subName: "木吉他自彈自唱", imageUrl: "https://loremflickr.com/200/200/acoustic,guitar,man?lock=5" },
  { id: "g5", name: "Rhythm Squad", subName: "Group of Dancers", imageUrl: "https://loremflickr.com/200/200/group,dancers?lock=1" },
  { id: "g6", name: "Electric Rush", subName: "電吉他自彈自唱", imageUrl: "https://loremflickr.com/200/200/electric,guitar,man?lock=1" },
  { id: "g7", name: "Acoustix", subName: "Acoustic Band", imageUrl: "/group1.jpg" },
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

export const MAX_VOTERS = 105;

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

  // Find T (max total votes across any award)
  let T = 0;
  for (const a of AWARDS) {
    let sum = 0;
    for (const g of GROUPS) {
      sum += rawVotes[a.id]?.[g.id] || 0;
    }
    if (sum > T) T = sum;
  }
  
  if (T > MAX_VOTERS) T = MAX_VOTERS;

  const adjustedVotes: Record<string, Record<string, number>> = {};

  for (const a of AWARDS) {
    const aId = a.id;
    adjustedVotes[aId] = {};
    
    // Initialize all to 0
    for (const g of GROUPS) {
      adjustedVotes[aId][g.id] = rawVotes[aId]?.[g.id] || 0;
    }

    if (T === 0) continue;

    const winnerId = winners[aId];
    
    // Ensure sum is exactly T
    let currentSum = 0;
    for (const g of GROUPS) {
      currentSum += adjustedVotes[aId][g.id];
    }
    
    if (currentSum < T) {
      // Add missing votes to the winner
      adjustedVotes[aId][winnerId] += (T - currentSum);
    } else if (currentSum > T) {
      // Should rarely happen if T is max, but just in case, remove from non-winners
      let excess = currentSum - T;
      while (excess > 0) {
        let maxOtherId = GROUPS[0].id;
        let maxOtherVal = -1;
        for (const g of GROUPS) {
          if (g.id !== winnerId && adjustedVotes[aId][g.id] > maxOtherVal) {
            maxOtherVal = adjustedVotes[aId][g.id];
            maxOtherId = g.id;
          }
        }
        if (maxOtherVal > 0) {
          adjustedVotes[aId][maxOtherId]--;
          excess--;
        } else {
          // If all others are 0, subtract from winner
          adjustedVotes[aId][winnerId]--;
          excess--;
        }
      }
    }

    // Steal votes to guarantee winner
    while (true) {
      let maxOther = -1;
      let maxOtherId = "";
      
      for (const g of GROUPS) {
        if (g.id !== winnerId) {
          const v = adjustedVotes[aId][g.id];
          if (v > maxOther) {
            maxOther = v;
            maxOtherId = g.id;
          }
        }
      }

      const winnerVotes = adjustedVotes[aId][winnerId];
      
      if (winnerVotes > maxOther) {
        break; // Winner is strictly greater
      }
      
      // Steal 1 vote
      adjustedVotes[aId][maxOtherId]--;
      adjustedVotes[aId][winnerId]++;
    }
  }

  return adjustedVotes;
}
