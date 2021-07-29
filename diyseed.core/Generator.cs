using System.Collections.Generic;
using PdfSharpCore.Pdf;
using PdfSharpCore.Pdf.IO;

namespace Diyseed.Core
{
    public class Generator
    {
        private GeneratorParameters parameters;
        private byte[] manual;

        public Generator(GeneratorParameters parameters, byte[] manualPdfFile)
        {
            this.parameters = parameters;
            manual = manualPdfFile;
        }

        public PdfDocument Generate()
        {
            var stencilGenerator = new WriterGenerator(parameters);
            var readerGenerator = new ReaderGenerator(parameters);
            var manualGenerator = new ManualGenerator(parameters, manual);

            var generatedPdfs = new List<PdfDocument>();

            // generate documents (they opened for modify)
            if (parameters.PdfSections.HasFlag(PdfSectionFlags.Writer))
            {
                var stencil = stencilGenerator.Generate();
                stencil.DrawHeader(Configuration.DOUMENT_WRITER_HEADER_TEXT, 1);
                stencil.DrawFooter(Configuration.DOUMENT_FOOTER_TEXT);
                generatedPdfs.Add(stencil);
            }

            if (parameters.PdfSections.HasFlag(PdfSectionFlags.Reader))
            {
                var reader = readerGenerator.Generate();
                reader.DrawHeader(Configuration.DOUMENT_READER_HEADER_TEXT, 1);
                reader.DrawFooter(Configuration.DOUMENT_FOOTER_TEXT);
                generatedPdfs.Add(reader);
            }

            if (parameters.PdfSections.HasFlag(PdfSectionFlags.Manual))
            {
                var manual = manualGenerator.Generate();
                manual.DrawHeader(Configuration.DOUMENT_MANUAL_HEADER_TEXT, 1);
                manual.DrawFooter(Configuration.DOUMENT_FOOTER_TEXT);
                generatedPdfs.Add(manual);
            }

            var joinedDoc = JoinDocuments(generatedPdfs.ToArray());
            return joinedDoc;
        }

        private PdfDocument JoinDocuments(params PdfDocument[] documents)
        {
            var document = new PdfDocument();
            document.Info.Title = Configuration.DOUMENT_TITLE;

            foreach (var doc in documents)
            {
                var importingDocu = doc.OpenInMode(PdfDocumentOpenMode.Import);
                foreach (var page in importingDocu.Pages)
                {
                    document.AddPage(page);
                }
            }

            return document;
        }
    }
}
