/**
 * Predictive Vote Forecasting
 * Uses linear regression, momentum analysis, and time-series vote modeling.
 * Pure JavaScript — no external ML libraries.
 */

/**
 * Simple linear regression: y = mx + b
 * Returns slope (m), intercept (b), and R-squared
 */
function linearRegression(points) {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: 0, rSquared: 0 };

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;

  points.forEach(([x, y]) => {
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
    sumY2 += y * y;
  });

  const denominator = (n * sumX2 - sumX * sumX);
  if (denominator === 0) return { slope: 0, intercept: sumY / n, rSquared: 0 };

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  // R-squared
  const yMean = sumY / n;
  const ssTot = points.reduce((sum, [, y]) => sum + (y - yMean) ** 2, 0);
  const ssRes = points.reduce((sum, [x, y]) => sum + (y - (slope * x + intercept)) ** 2, 0);
  const rSquared = ssTot > 0 ? 1 - (ssRes / ssTot) : 0;

  return { slope, intercept, rSquared: Math.max(0, rSquared) };
}

/**
 * Build hourly vote accumulation time series
 */
function buildTimeSeries(votes, startTime) {
  const start = new Date(startTime).getTime();
  const now = Date.now();
  const hourMs = 60 * 60 * 1000;

  // Group votes by hour offset from poll start
  const hourlyBuckets = {};
  votes.forEach(vote => {
    const voteTime = new Date(vote.createdAt).getTime();
    const hourOffset = Math.floor((voteTime - start) / hourMs);
    if (hourOffset >= 0) {
      hourlyBuckets[hourOffset] = (hourlyBuckets[hourOffset] || 0) + 1;
    }
  });

  const totalHours = Math.max(1, Math.ceil((now - start) / hourMs));

  // Build cumulative time series
  const series = [];
  let cumulative = 0;
  for (let h = 0; h <= totalHours; h++) {
    cumulative += hourlyBuckets[h] || 0;
    series.push({ hour: h, votes: cumulative, newVotes: hourlyBuckets[h] || 0 });
  }

  return series;
}

/**
 * Calculate momentum — rate of change in recent voting
 */
function calculateMomentum(timeSeries) {
  if (timeSeries.length < 3) return { direction: 'Stable', value: 0, description: 'Not enough data' };

  const recentWindow = timeSeries.slice(-6);
  const olderWindow = timeSeries.slice(-12, -6);

  const recentRate = recentWindow.reduce((s, p) => s + p.newVotes, 0) / Math.max(1, recentWindow.length);
  const olderRate = olderWindow.length > 0
    ? olderWindow.reduce((s, p) => s + p.newVotes, 0) / olderWindow.length
    : recentRate;

  const momentumValue = olderRate > 0 ? ((recentRate - olderRate) / olderRate) * 100 : 0;

  let direction, description;
  if (momentumValue > 30) {
    direction = 'Accelerating';
    description = `Voting rate surging ${Math.round(momentumValue)}% — strong upward momentum`;
  } else if (momentumValue > 10) {
    direction = 'Increasing';
    description = `Voting rate growing ${Math.round(momentumValue)}% — healthy momentum`;
  } else if (momentumValue < -30) {
    direction = 'Declining';
    description = `Voting rate dropped ${Math.round(Math.abs(momentumValue))}% — fading interest`;
  } else if (momentumValue < -10) {
    direction = 'Slowing';
    description = `Voting rate decreasing ${Math.round(Math.abs(momentumValue))}% — natural taper`;
  } else {
    direction = 'Stable';
    description = 'Voting rate is holding steady';
  }

  return { direction, value: Math.round(momentumValue), description };
}

/**
 * Main forecast function
 */
export function forecastPoll(poll, votes) {
  const startTime = new Date(poll.startTime);
  const endTime = new Date(poll.endTime);
  const now = new Date();
  const isActive = now < endTime && now >= startTime;

  const totalVotesSoFar = votes.length;
  const timeSeries = buildTimeSeries(votes, startTime);

  // Build regression on cumulative vote data
  const regressionPoints = timeSeries.map(p => [p.hour, p.votes]);
  const regression = linearRegression(regressionPoints);

  // Project to end time
  const totalHoursOfPoll = Math.max(1, (endTime - startTime) / (60 * 60 * 1000));
  const projectedTotal = Math.max(
    totalVotesSoFar,
    Math.round(regression.slope * totalHoursOfPoll + regression.intercept)
  );

  // Per-option projections
  const optionVotes = {};
  votes.forEach(v => {
    const idx = v.optionIndex;
    optionVotes[idx] = (optionVotes[idx] || 0) + 1;
  });

  const projectedOptions = (poll.options || []).map((opt, i) => {
    const currentVotes = optionVotes[i] || 0;
    const ratio = totalVotesSoFar > 0 ? currentVotes / totalVotesSoFar : 1 / (poll.options.length || 1);
    const projected = Math.round(projectedTotal * ratio);
    return {
      optionText: opt.optionText,
      currentVotes,
      projectedVotes: projected,
      currentPercent: totalVotesSoFar > 0 ? Math.round((currentVotes / totalVotesSoFar) * 100) : 0,
      projectedPercent: projectedTotal > 0 ? Math.round((projected / projectedTotal) * 100) : 0
    };
  });

  // Winner prediction
  const sortedOptions = [...projectedOptions].sort((a, b) => b.projectedVotes - a.projectedVotes);
  const predictedWinner = sortedOptions[0] || null;
  const secondPlace = sortedOptions[1] || null;

  let winConfidence = 50;
  if (predictedWinner && secondPlace && projectedTotal > 0) {
    const margin = (predictedWinner.projectedVotes - secondPlace.projectedVotes) / projectedTotal;
    winConfidence = Math.min(98, Math.round(50 + margin * 200));
  } else if (predictedWinner && !secondPlace) {
    winConfidence = 99;
  }

  // Momentum analysis
  const momentum = calculateMomentum(timeSeries);

  // Hourly trend for chart (last 24 data points max)
  const hourlyTrend = timeSeries.slice(-24).map(p => ({
    hour: `H${p.hour}`,
    votes: p.newVotes
  }));

  // Confidence in the regression model
  const modelConfidence = regression.rSquared > 0.8 ? 'High' :
                          regression.rSquared > 0.5 ? 'Moderate' :
                          regression.rSquared > 0.2 ? 'Low' : 'Very Low';

  // Time remaining
  const hoursRemaining = isActive ? Math.max(0, Math.round((endTime - now) / (60 * 60 * 1000))) : 0;
  const percentTimeElapsed = Math.min(100, Math.round(((now - startTime) / (endTime - startTime)) * 100));

  return {
    isActive,
    totalVotesSoFar,
    projectedTotalVotes: projectedTotal,
    projectedOptions,
    predictedWinner: predictedWinner ? {
      optionText: predictedWinner.optionText,
      confidence: winConfidence,
      projectedVotes: predictedWinner.projectedVotes,
      projectedPercent: predictedWinner.projectedPercent
    } : null,
    momentum,
    hourlyTrend,
    modelConfidence,
    rSquared: Math.round(regression.rSquared * 100) / 100,
    hoursRemaining,
    percentTimeElapsed
  };
}
