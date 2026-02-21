import mongoose from 'mongoose';

const voteSchema = new mongoose.Schema({
    pollId: { type: mongoose.Schema.Types.ObjectId, ref: 'Poll', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    optionIndex: { type: Number, required: true }
}, { timestamps: true });

// Prevent duplicate votes by creating a compound index
voteSchema.index({ pollId: 1, userId: 1 }, { unique: true });

const Vote = mongoose.model('Vote', voteSchema);
export default Vote;
