import mongoose from 'mongoose';

const pollSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    options: [{
        optionText: { type: String, required: true },
        voteCount: { type: Number, default: 0 }
    }],
    visibility: { type: String, enum: ['Student', 'Staff', 'Both'], default: 'Both' },
    anonymous: { type: Boolean, default: false },
    allowLiveResults: { type: Boolean, default: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
}, { timestamps: true });

const Poll = mongoose.model('Poll', pollSchema);
export default Poll;
