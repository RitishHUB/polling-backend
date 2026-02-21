import mongoose from 'mongoose';

const badgeSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    badgeName: { type: String, required: true },
}, { timestamps: true });

// Prevent duplicate badges
badgeSchema.index({ userId: 1, badgeName: 1 }, { unique: true });

const Badge = mongoose.model('Badge', badgeSchema);
export default Badge;
