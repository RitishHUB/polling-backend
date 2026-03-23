/**
 * Anomaly Detection & Voter Behavior Analysis
 * Uses Z-score analysis, velocity spike detection, and statistical distribution tests.
 * Pure JavaScript — no external ML libraries.
 */

/**
 * Calculate mean and standard deviation
 */
function stats(values) {
  if (values.length === 0) return { mean: 0, std: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return { mean, std: Math.sqrt(variance) };
}

/**
 * Z-score for a value given mean and std
 */
function zScore(value, mean, std) {
  if (std === 0) return 0;
  return (value - mean) / std;
}

/**
 * Detect vote velocity spikes
 * Looks for unusual bursts of voting activity
 */
function detectVelocitySpikes(votes, startTime) {
  const start = new Date(startTime).getTime();
  const minuteMs = 60 * 1000;

  // Group votes into 15-minute windows
  const windows = {};
  votes.forEach(vote => {
    const voteTime = new Date(vote.createdAt).getTime();
    const windowIndex = Math.floor((voteTime - start) / (15 * minuteMs));
    windows[windowIndex] = (windows[windowIndex] || 0) + 1;
  });

  const windowValues = Object.values(windows);
  if (windowValues.length < 3) return { spikes: [], severity: 'None' };

  const { mean, std } = stats(windowValues);
  const spikes = [];

  Object.entries(windows).forEach(([windowIdx, count]) => {
    const z = zScore(count, mean, std);
    if (z > 2) { // More than 2 standard deviations above mean
      const timeOffset = parseInt(windowIdx) * 15;
      const hours = Math.floor(timeOffset / 60);
      const mins = timeOffset % 60;
      spikes.push({
        timeWindow: `${hours}h ${mins}m - ${hours}h ${mins + 15}m`,
        votesInWindow: count,
        zScore: Math.round(z * 100) / 100,
        severity: z > 3 ? 'High' : 'Moderate',
        description: `${count} votes in 15 min (avg: ${Math.round(mean * 10) / 10})`
      });
    }
  });

  const severity = spikes.some(s => s.severity === 'High') ? 'High' :
                   spikes.length > 0 ? 'Moderate' : 'None';

  return { spikes, severity };
}

/**
 * Detect option distribution anomalies
 * Flags when one option gets a statistically improbable share of votes
 */
function detectDistributionAnomalies(poll) {
  const totalVotes = poll.options.reduce((s, o) => s + (o.voteCount || 0), 0);
  if (totalVotes < 5) return { anomalies: [], isBalanced: true };

  const optionCount = poll.options.length;
  const expectedEach = totalVotes / optionCount;
  const voteCounts = poll.options.map(o => o.voteCount || 0);
  const { mean, std } = stats(voteCounts);

  const anomalies = [];

  poll.options.forEach((opt, i) => {
    const count = opt.voteCount || 0;
    const z = zScore(count, mean, std);
    const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;

    if (Math.abs(z) > 1.8) {
      anomalies.push({
        optionText: opt.optionText,
        votes: count,
        percentage,
        zScore: Math.round(z * 100) / 100,
        type: z > 0 ? 'Unusually High' : 'Unusually Low',
        description: z > 0
          ? `"${opt.optionText}" has ${percentage}% of votes — significantly above expected ${Math.round(100 / optionCount)}%`
          : `"${opt.optionText}" has only ${percentage}% of votes — well below expected ${Math.round(100 / optionCount)}%`
      });
    }
  });

  // Chi-squared test (simplified)
  const chiSquared = voteCounts.reduce((sum, observed) => {
    return sum + ((observed - expectedEach) ** 2) / expectedEach;
  }, 0);

  // Degrees of freedom = optionCount - 1
  // For df=1: critical χ² at p=0.05 is 3.84 // df=2: 5.99 // df=3: 7.81 // df=4: 9.49
  const criticalValues = { 1: 3.84, 2: 5.99, 3: 7.81, 4: 9.49, 5: 11.07, 6: 12.59 };
  const df = optionCount - 1;
  const criticalValue = criticalValues[df] || (df * 2 + 1);
  const isBalanced = chiSquared <= criticalValue;

  return {
    anomalies,
    isBalanced,
    chiSquared: Math.round(chiSquared * 100) / 100,
    chiSquaredCritical: criticalValue
  };
}

/**
 * Detect time-pattern anomalies
 * E.g., votes clustering at unusual hours
 */
function detectTimePatterns(votes) {
  if (votes.length < 5) return { patterns: [], unusualHours: [] };

  // Hour distribution
  const hourBuckets = new Array(24).fill(0);
  votes.forEach(v => {
    const hour = new Date(v.createdAt).getHours();
    hourBuckets[hour]++;
  });

  const { mean, std } = stats(hourBuckets.filter(h => h > 0));
  const unusualHours = [];

  hourBuckets.forEach((count, hour) => {
    if (count > 0) {
      const z = zScore(count, mean, std);
      if (z > 1.5) {
        unusualHours.push({
          hour: `${hour}:00 - ${hour + 1}:00`,
          votes: count,
          zScore: Math.round(z * 100) / 100,
          description: count > mean * 2
            ? `Unusually high activity at ${hour}:00 (${count} votes)`
            : `Above-average activity at ${hour}:00`
        });
      }
    }
  });

  // Check for off-hours voting (midnight to 5 AM)
  const offHoursVotes = hourBuckets.slice(0, 5).reduce((s, c) => s + c, 0);
  const offHoursPercent = votes.length > 0 ? Math.round((offHoursVotes / votes.length) * 100) : 0;

  const patterns = [];
  if (offHoursPercent > 30) {
    patterns.push({
      type: 'Off-Hours Activity',
      severity: 'Moderate',
      description: `${offHoursPercent}% of votes cast between midnight and 5 AM`,
      detail: 'This could indicate automated voting or unusual participation patterns'
    });
  }

  // Check for weekend vs weekday distribution
  let weekdayVotes = 0, weekendVotes = 0;
  votes.forEach(v => {
    const day = new Date(v.createdAt).getDay();
    if (day === 0 || day === 6) weekendVotes++;
    else weekdayVotes++;
  });

  if (votes.length > 10 && weekendVotes > weekdayVotes * 1.5) {
    patterns.push({
      type: 'Weekend Clustering',
      severity: 'Low',
      description: `${Math.round((weekendVotes / votes.length) * 100)}% of votes cast on weekends`,
      detail: 'Weekend-heavy voting is unusual for campus polls'
    });
  }

  return { patterns, unusualHours };
}

/**
 * Main anomaly detection function
 */
export function detectAnomalies(poll, votes) {
  const velocityResult = detectVelocitySpikes(votes, poll.startTime);
  const distributionResult = detectDistributionAnomalies(poll);
  const timeResult = detectTimePatterns(votes);

  // Calculate overall integrity score (100 = perfect, 0 = very suspicious)
  let integrityScore = 100;
  const alerts = [];

  // Velocity penalties
  velocityResult.spikes.forEach(spike => {
    if (spike.severity === 'High') {
      integrityScore -= 15;
      alerts.push({
        type: 'velocity',
        severity: 'High',
        icon: '⚡',
        title: 'Voting Velocity Spike',
        message: spike.description,
        detail: `Z-score: ${spike.zScore} at ${spike.timeWindow}`
      });
    } else {
      integrityScore -= 8;
      alerts.push({
        type: 'velocity',
        severity: 'Moderate',
        icon: '⚡',
        title: 'Unusual Voting Burst',
        message: spike.description,
        detail: `Z-score: ${spike.zScore} at ${spike.timeWindow}`
      });
    }
  });

  // Distribution penalties
  distributionResult.anomalies.forEach(anomaly => {
    integrityScore -= 10;
    alerts.push({
      type: 'distribution',
      severity: Math.abs(anomaly.zScore) > 2.5 ? 'High' : 'Moderate',
      icon: '📊',
      title: `${anomaly.type} Vote Share`,
      message: anomaly.description,
      detail: `Z-score: ${anomaly.zScore}`
    });
  });

  // Time pattern penalties
  timeResult.patterns.forEach(pattern => {
    integrityScore -= pattern.severity === 'Moderate' ? 10 : 5;
    alerts.push({
      type: 'time_pattern',
      severity: pattern.severity,
      icon: '🕐',
      title: pattern.type,
      message: pattern.description,
      detail: pattern.detail
    });
  });

  integrityScore = Math.max(0, Math.min(100, integrityScore));

  // Overall risk level
  let riskLevel;
  if (integrityScore >= 85) riskLevel = 'Low';
  else if (integrityScore >= 65) riskLevel = 'Moderate';
  else if (integrityScore >= 40) riskLevel = 'High';
  else riskLevel = 'Critical';

  // Summary
  let summary;
  if (alerts.length === 0) {
    summary = 'No anomalies detected. Voting patterns appear normal and organic.';
  } else if (riskLevel === 'Low') {
    summary = `Minor irregularities found (${alerts.length} alert${alerts.length > 1 ? 's' : ''}), but within acceptable bounds.`;
  } else if (riskLevel === 'Moderate') {
    summary = `Some suspicious patterns detected (${alerts.length} alert${alerts.length > 1 ? 's' : ''}). Manual review recommended.`;
  } else {
    summary = `Significant anomalies detected (${alerts.length} alert${alerts.length > 1 ? 's' : ''}). Immediate review strongly recommended.`;
  }

  return {
    riskLevel,
    integrityScore,
    summary,
    totalAlerts: alerts.length,
    alerts: alerts.sort((a, b) => {
      const sev = { 'High': 3, 'Moderate': 2, 'Low': 1 };
      return (sev[b.severity] || 0) - (sev[a.severity] || 0);
    }),
    details: {
      velocity: velocityResult,
      distribution: {
        ...distributionResult,
        isBalanced: distributionResult.isBalanced
      },
      timePatterns: timeResult
    }
  };
}
