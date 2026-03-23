/**
 * Smart Poll Recommendation System (ML)
 * Uses collaborative filtering + content-based filtering.
 * Pure JavaScript — no external ML libraries.
 */

/**
 * Cosine similarity between two vectors
 */
function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (normA * normB);
}

/**
 * Build a user-poll interaction matrix for collaborative filtering
 */
function buildInteractionMatrix(allVotes, allPolls, allUserIds) {
  const pollIdToIndex = {};
  allPolls.forEach((p, i) => { pollIdToIndex[p._id.toString()] = i; });

  const userIdToIndex = {};
  allUserIds.forEach((uid, i) => { userIdToIndex[uid] = i; });

  // Create matrix: users x polls (1 = voted, 0 = not voted)
  const matrix = Array.from({ length: allUserIds.length }, () =>
    new Array(allPolls.length).fill(0)
  );

  allVotes.forEach(vote => {
    const uid = vote.userId?.toString() || vote.userId;
    const pid = vote.pollId?.toString() || vote.pollId;
    const userIdx = userIdToIndex[uid];
    const pollIdx = pollIdToIndex[pid];
    if (userIdx !== undefined && pollIdx !== undefined) {
      matrix[userIdx][pollIdx] = 1;
    }
  });

  return { matrix, pollIdToIndex, userIdToIndex };
}

/**
 * Content-based scoring: how well a poll matches user preferences
 */
function contentScore(poll, userVotedPolls) {
  if (userVotedPolls.length === 0) return 0.3; // baseline for new users

  let score = 0;
  let factors = 0;

  // Category match
  const votedCategories = {};
  userVotedPolls.forEach(p => {
    const cat = p.category || 'General';
    votedCategories[cat] = (votedCategories[cat] || 0) + 1;
  });

  const totalVoted = userVotedPolls.length;
  const pollCat = poll.category || 'General';
  if (votedCategories[pollCat]) {
    score += (votedCategories[pollCat] / totalVoted) * 0.4;
  }
  factors++;

  // Visibility match — polls targeting the user's group
  if (poll.visibility === 'Both') {
    score += 0.15;
  }
  factors++;

  // Keyword overlap between poll title/description and voted poll titles
  const pollWords = new Set(
    `${poll.title} ${poll.description || ''}`.toLowerCase().split(/\s+/).filter(w => w.length > 3)
  );
  const votedWords = new Set();
  userVotedPolls.forEach(p => {
    `${p.title} ${p.description || ''}`.toLowerCase().split(/\s+/).filter(w => w.length > 3).forEach(w => votedWords.add(w));
  });

  const intersection = [...pollWords].filter(w => votedWords.has(w)).length;
  const union = new Set([...pollWords, ...votedWords]).size;
  if (union > 0) {
    score += (intersection / union) * 0.3; // Jaccard similarity
  }
  factors++;

  return factors > 0 ? score / factors * 3 : 0; // normalize to ~0-1
}

/**
 * Recency score — newer polls get higher scores
 */
function recencyScore(poll) {
  const now = new Date();
  const created = new Date(poll.createdAt);
  const hoursSinceCreation = (now - created) / (1000 * 60 * 60);

  if (hoursSinceCreation < 6) return 1.0;
  if (hoursSinceCreation < 24) return 0.8;
  if (hoursSinceCreation < 72) return 0.6;
  if (hoursSinceCreation < 168) return 0.4; // 1 week
  return 0.2;
}

/**
 * Trending score — polls gaining votes fast
 */
function trendingScore(poll, recentVotes) {
  const pollVotes = recentVotes.filter(v => (v.pollId?.toString() || v.pollId) === poll._id.toString());
  const last24h = pollVotes.filter(v => {
    const voteTime = new Date(v.createdAt);
    return (Date.now() - voteTime) < 24 * 60 * 60 * 1000;
  });

  if (last24h.length > 10) return 1.0;
  if (last24h.length > 5) return 0.7;
  if (last24h.length > 2) return 0.4;
  return 0.1;
}

/**
 * Main recommendation function
 * @param {string} userId - current user ID
 * @param {Array} allPolls - all polls in the system
 * @param {Array} allVotes - all votes in the system
 * @returns {Array} recommended polls with scores and reasons
 */
export function getRecommendations(userId, allPolls, allVotes) {
  const userIdStr = userId.toString();

  // Find polls user already voted on
  const userVotedPollIds = new Set(
    allVotes
      .filter(v => (v.userId?.toString() || v.userId) === userIdStr)
      .map(v => v.pollId?.toString() || v.pollId)
  );

  // Only recommend active, unvoted polls
  const now = new Date();
  const candidatePolls = allPolls.filter(p =>
    !userVotedPollIds.has(p._id.toString()) &&
    new Date(p.endTime) > now &&
    new Date(p.startTime) <= now
  );

  if (candidatePolls.length === 0) {
    return [];
  }

  // Get user's voted polls for content-based filtering
  const userVotedPolls = allPolls.filter(p => userVotedPollIds.has(p._id.toString()));

  // Collaborative filtering: find similar users
  const allUserIds = [...new Set(allVotes.map(v => v.userId?.toString() || v.userId))];
  const { matrix, userIdToIndex } = buildInteractionMatrix(allVotes, allPolls, allUserIds);
  const currentUserIdx = userIdToIndex[userIdStr];

  let collaborativeScores = {};
  if (currentUserIdx !== undefined) {
    const currentUserVec = matrix[currentUserIdx];

    // Find top-5 similar users
    const similarities = allUserIds
      .map((uid, idx) => ({ userId: uid, similarity: cosineSimilarity(currentUserVec, matrix[idx]) }))
      .filter(s => s.userId !== userIdStr && s.similarity > 0)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);

    // Aggregate their votes as collaborative signals
    similarities.forEach(sim => {
      const simUserIdx = userIdToIndex[sim.userId];
      if (simUserIdx !== undefined) {
        matrix[simUserIdx].forEach((voted, pollIdx) => {
          if (voted === 1) {
            const pollId = allPolls[pollIdx]?._id?.toString();
            if (pollId && !userVotedPollIds.has(pollId)) {
              collaborativeScores[pollId] = (collaborativeScores[pollId] || 0) + sim.similarity * 0.3;
            }
          }
        });
      }
    });
  }

  // Score each candidate poll
  const scoredPolls = candidatePolls.map(poll => {
    const pollId = poll._id.toString();
    const content = contentScore(poll, userVotedPolls);
    const recency = recencyScore(poll);
    const trending = trendingScore(poll, allVotes);
    const collaborative = collaborativeScores[pollId] || 0;

    // Weighted combination
    const finalScore = (content * 0.35) + (collaborative * 0.25) + (recency * 0.20) + (trending * 0.20);

    // Build human-readable reasons
    const reasons = [];
    if (content > 0.3) reasons.push('Matches your interests');
    if (collaborative > 0.1) reasons.push('Users like you voted here');
    if (recency > 0.7) reasons.push('Recently created');
    if (trending > 0.5) reasons.push('Trending now');

    const pollCat = poll.category || 'General';
    const votedCategories = {};
    userVotedPolls.forEach(p => {
      const cat = p.category || 'General';
      votedCategories[cat] = (votedCategories[cat] || 0) + 1;
    });
    if (votedCategories[pollCat]) reasons.push(`You like ${pollCat} polls`);

    if (reasons.length === 0) reasons.push('Explore something new');

    return {
      poll,
      matchScore: Math.min(99, Math.round(finalScore * 100)),
      reasons: [...new Set(reasons)].slice(0, 3),
      breakdown: {
        content: Math.round(content * 100),
        collaborative: Math.round(collaborative * 100),
        recency: Math.round(recency * 100),
        trending: Math.round(trending * 100)
      }
    };
  });

  // Sort by score descending, add diversity (don't stack same category)
  scoredPolls.sort((a, b) => b.matchScore - a.matchScore);

  const diversified = [];
  const categoryCount = {};
  const maxPerCategory = 3;

  for (const item of scoredPolls) {
    const cat = item.poll.category || 'General';
    if ((categoryCount[cat] || 0) < maxPerCategory) {
      diversified.push(item);
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    }
    if (diversified.length >= 10) break;
  }

  return diversified;
}
