import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { exportService } from '../services/export.service';

export const exportTree = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { format = 'json', scope = 'full' } = req.query;

    if (format !== 'json') {
      res.status(400).json({
        error: 'Invalid format. Currently only "json" is supported',
      });
      return;
    }

    let exportData;

    if (scope === 'user-only') {
      // Export only user's owned branches
      exportData = await exportService.exportUserBranches(req.user.id);
    } else {
      // Export entire tree (default)
      exportData = await exportService.exportAsJSON(req.user.id);
    }

    const filename = exportService.generateFilename(format as string);

    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    res.json(exportData);
  } catch (error) {
    console.error('Export tree error:', error);
    res.status(500).json({ error: 'Failed to export family tree' });
  }
};

export const getExportPreview = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Get basic stats for export preview
    const exportData = await exportService.exportAsJSON(req.user.id);

    // Return just metadata without full data
    res.json({
      metadata: exportData.metadata,
      version: exportData.version,
      exportedBy: exportData.exportedBy,
      preview: {
        personsCount: exportData.persons.length,
        relationshipsCount: exportData.relationships.length,
        samplePersons: exportData.persons.slice(0, 5),
        sampleRelationships: exportData.relationships.slice(0, 5),
      },
    });
  } catch (error) {
    console.error('Get export preview error:', error);
    res.status(500).json({ error: 'Failed to generate export preview' });
  }
};
