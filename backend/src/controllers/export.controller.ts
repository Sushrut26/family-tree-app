import { Response } from 'express';
import PDFDocument from 'pdfkit';
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

    const { format = 'json', scope = 'user-only' } = req.query;

    if (format !== 'json' && format !== 'pdf') {
      res.status(400).json({
        error: 'Invalid format. Supported formats: "json", "pdf"',
      });
      return;
    }

    if (format === 'pdf' && req.user.role !== 'ADMIN') {
      res.status(403).json({
        error: 'PDF export is restricted to administrators',
      });
      return;
    }

    let exportData;

    if (scope === 'full') {
      // Full export restricted to admins only
      if (req.user.role !== 'ADMIN') {
        res.status(403).json({
          error: 'Full tree export is restricted to administrators',
        });
        return;
      }
      exportData = await exportService.exportAsJSON(req.user.id);
    } else {
      // Default: export only user's owned branches
      exportData = await exportService.exportUserBranches(req.user.id);
    }

    const filename = exportService.generateFilename(format as string);

    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      const doc = new PDFDocument({ margin: 40 });
      doc.pipe(res);

      doc.fontSize(18).text('Family Relationships Export', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(11).text(`Exported at: ${exportData.exportedAt}`);
      doc.text(`Total relationships: ${exportData.relationships.length}`);
      doc.moveDown();

      const formatType = (type: string) => {
        switch (type) {
          case 'PARENT':
            return 'Parent -> Child';
          case 'SPOUSE':
            return 'Spouse / Partner';
          case 'SIBLING':
            return 'Sibling';
          default:
            return type;
        }
      };

      exportData.relationships.forEach((rel, index) => {
        const person1 = rel.person1
          ? `${rel.person1.firstName} ${rel.person1.lastName}`
          : rel.person1Id;
        const person2 = rel.person2
          ? `${rel.person2.firstName} ${rel.person2.lastName}`
          : rel.person2Id;

        if (doc.y > doc.page.height - 80) {
          doc.addPage();
        }

        doc
          .fontSize(11)
          .text(`${index + 1}. ${person1}  [${formatType(rel.relationshipType)}]  ${person2}`);
      });

      doc.end();
      return;
    }

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

    // Non-admins only see their own data in preview
    const exportData = req.user.role === 'ADMIN'
      ? await exportService.exportAsJSON(req.user.id)
      : await exportService.exportUserBranches(req.user.id);

    // Return just metadata without full data
    res.json({
      metadata: exportData.metadata,
      version: exportData.version,
      exportedBy: {
        id: exportData.exportedBy.id,
        firstName: exportData.exportedBy.firstName,
        lastName: exportData.exportedBy.lastName,
        // Don't expose email in preview
      },
      preview: {
        personsCount: exportData.persons.length,
        relationshipsCount: exportData.relationships.length,
        samplePersons: exportData.persons.slice(0, 5).map(p => ({
          id: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
        })),
        sampleRelationships: exportData.relationships.slice(0, 5),
      },
    });
  } catch (error) {
    console.error('Get export preview error:', error);
    res.status(500).json({ error: 'Failed to generate export preview' });
  }
};
