import Poll from '../models/Poll.js';
import Vote from '../models/Vote.js';
import Badge from '../models/Badge.js';
import User from '../models/User.js';

// @desc    Create a new poll
// @route   POST /api/polls
// @access  Private/Staff/Admin
export const createPoll = async (req, res) => {
    try {
        const { title, description, options, visibility, anonymous, allowLiveResults, startTime, endTime } = req.body;

        const formattedOptions = options.map(opt => ({ optionText: opt }));

        const poll = new Poll({
            title,
            description,
            createdBy: req.user._id,
            options: formattedOptions,
            visibility,
            anonymous,
            allowLiveResults,
            startTime,
            endTime
        });

        const createdPoll = await poll.save();
        res.status(201).json(createdPoll);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all active/relevant polls
// @route   GET /api/polls
// @access  Private
// Allows visibility filtering: Students see 'Student' and 'Both', Staff see 'Staff' and 'Both'
export const getPolls = async (req, res) => {
    try {
        let query = {};
        if (req.user.role === 'Student') {
            query.visibility = { $in: ['Student', 'Both'] };
        } else if (req.user.role === 'Staff') {
            // Staff might want to see all polls they created OR polls visible to Staff/Both
            query = {
                $or: [
                    { visibility: { $in: ['Staff', 'Both'] } },
                    { createdBy: req.user._id }
                ]
            };
        }
        // Admin sees everything

        const polls = await Poll.find(query)
            .populate('createdBy', 'name')
            .sort({ createdAt: -1 });
        res.json(polls);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get poll by ID
// @route   GET /api/polls/:id
// @access  Private
export const getPollById = async (req, res) => {
    try {
        const poll = await Poll.findById(req.params.id).populate('createdBy', 'name');
        if (poll) {
            // Check if user has voted
            const vote = await Vote.findOne({ pollId: poll._id, userId: req.user._id });
            res.json({ ...poll._doc, hasVoted: !!vote });
        } else {
            res.status(404).json({ message: 'Poll not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Vote in a poll
// @route   POST /api/polls/:id/vote
// @access  Private
export const votePoll = async (req, res) => {
    try {
        const { optionIndex } = req.body;
        const poll = await Poll.findById(req.params.id);

        if (!poll) {
            return res.status(404).json({ message: 'Poll not found' });
        }

        // Check time constraints
        const now = new Date();
        if (now < new Date(poll.startTime)) {
            return res.status(400).json({ message: 'Voting has not started yet' });
        }
        if (now > new Date(poll.endTime)) {
            return res.status(400).json({ message: 'Voting has ended' });
        }

        // Check if user already voted
        const alreadyVoted = await Vote.findOne({ pollId: poll._id, userId: req.user._id });
        if (alreadyVoted) {
            return res.status(400).json({ message: 'You have already voted in this poll' });
        }

        if (optionIndex < 0 || optionIndex >= poll.options.length) {
            return res.status(400).json({ message: 'Invalid option selected' });
        }

        // Record the vote
        await Vote.create({
            pollId: poll._id,
            userId: req.user._id,
            optionIndex
        });

        // Increment vote count in poll options
        poll.options[optionIndex].voteCount += 1;
        await poll.save();

        // Trigger badge evaluation
        const voteCount = await Vote.countDocuments({ userId: req.user._id });

        // Check and award badges
        let newBadge = null;
        if (voteCount === 5) {
            await Badge.create({ userId: req.user._id, badgeName: 'Beginner' }).catch(e => console.log(e));
            newBadge = 'Beginner';
        } else if (voteCount === 10) {
            await Badge.create({ userId: req.user._id, badgeName: 'Active' }).catch(e => console.log(e));
            newBadge = 'Active';
        } else if (voteCount === 25) {
            await Badge.create({ userId: req.user._id, badgeName: 'Champion' }).catch(e => console.log(e));
            newBadge = 'Champion';
        }

        res.status(201).json({ message: 'Vote recorded successfully', newBadge });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete a poll
// @route   DELETE /api/polls/:id
// @access  Private/Admin
export const deletePoll = async (req, res) => {
    try {
        const poll = await Poll.findById(req.params.id);

        if (poll) {
            await Vote.deleteMany({ pollId: poll._id }); // Delete associated votes
            await poll.deleteOne();
            res.json({ message: 'Poll removed' });
        } else {
            res.status(404).json({ message: 'Poll not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get detailed poll results (including voters)
// @route   GET /api/polls/:id/results
// @access  Private/Staff/Admin
export const getPollResults = async (req, res) => {
    try {
        const poll = await Poll.findById(req.params.id);
        if (!poll) {
            return res.status(404).json({ message: 'Poll not found' });
        }

        let votesQuery = Vote.find({ pollId: poll._id });
        if (req.user.role === 'Admin') {
            votesQuery = votesQuery.populate('userId', 'name email role department');
        }
        const votes = await votesQuery;

        // Group voters by the option they selected
        const results = poll.options.map((opt, index) => {
            const optionVotes = votes.filter(v => v.optionIndex === index);
            const resultObj = {
                optionText: opt.optionText,
                voteCount: opt.voteCount,
            };

            // Only attach identities if the requestor is an Admin
            if (req.user.role === 'Admin') {
                resultObj.voters = optionVotes.map(v => v.userId).filter(u => u !== null);
            }

            return resultObj;
        });

        res.json({
            pollTitle: poll.title,
            totalVotes: votes.length,
            results
        });

    } catch (error) {
        console.error("DEBUG ERROR: ", error);
        res.status(500).json({ message: error.message });
    }
};
