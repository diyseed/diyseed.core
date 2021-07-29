using System.IO;
using PdfSharpCore.Pdf;
using PdfSharpCore.Pdf.IO;

namespace Diyseed.Core
{
    public class ManualGenerator
    {
        private PdfDocument document;
        private GeneratorParameters parameters;
        private byte[] manual;

        public ManualGenerator(GeneratorParameters parameters, byte[] manualPdf)
        {
            document = new PdfDocument();
            this.parameters = parameters;
            manual = manualPdf;
        }

        public PdfDocument Generate()
        {
            using (var stream = new MemoryStream(manual))
            {
                var manualDocument = PdfReader.Open(stream, PdfDocumentOpenMode.Import | PdfDocumentOpenMode.Modify);
                foreach (var page in manualDocument.Pages)
                {
                    document.AddPage(page);
                }
            }

            return document.OpenInMode(PdfDocumentOpenMode.Modify);
        }
    }
}
