import { Router } from 'express';
import multer from 'multer';
import {
    createComplaint,
    getComplaint,
    getComplaints,
    updateComplaintStatus,
    resolveComplaint,
    getComplaintHistory,
    uploadAttachment
} from '../controllers/complaint.controller';

const router = Router();

// Configure multer for file uploads
const upload = multer({
    dest: 'uploads/',
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, and PDF allowed.'));
        }
    }
});

// Routes
router.post('/', upload.array('attachments', 5), createComplaint);
router.get('/', getComplaints);
router.get('/:id', getComplaint);
router.patch('/:id/status', updateComplaintStatus);
router.post('/:id/resolve', resolveComplaint);
router.get('/:id/history', getComplaintHistory);
router.post('/:id/attachments', upload.single('file'), uploadAttachment);

export default router;
