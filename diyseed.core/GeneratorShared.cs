using PdfSharpCore.Drawing;
using PdfSharpCore.Pdf;
using PdfSharpCore.Pdf.IO;
using System.IO;
using System.Linq;

namespace Diyseed.Core
{
    public static class GeneratorShared
    {
        public static XFont GetFontForBox(this XGraphics gfx, string fontName, XFontStyle style, (double, double) fontSizeRange, double increaseStep, string sampleText, XSize maxSize)
        {
            double fontSize = fontSizeRange.Item1 - increaseStep;
            XFont font;
            XSize stringSize;
            do
            {
                fontSize += increaseStep;
                font = new XFont(fontName, fontSize, style);
                stringSize = gfx.MeasureString(sampleText, font);
            } while (font.Size <= fontSizeRange.Item2 && stringSize.Width < maxSize.Width && stringSize.Height < maxSize.Height);

            return font;
        }

        public static PdfDocument OpenInMode(this PdfDocument document, PdfDocumentOpenMode mode)
        {
            PdfDocument ret;
            using (var stream = new MemoryStream())
            {
                document.Save(stream);
                ret = PdfReader.Open(stream, mode);
            }

            return ret;
        }

        public static void DrawPageHeader(this PdfPage page, string text)
        {
            using (var gfx = XGraphics.FromPdfPage(page))
            {
                var state = gfx.Save();

                gfx.TranslateTransform(Configuration.DOCUMENT_MARGIN_H, 0);
                XStringFormat format = new XStringFormat();
                format.Alignment = XStringAlignment.Near;
                format.LineAlignment = XLineAlignment.Center;
                var size = new XSize(Configuration.EFFECTIVE_PAGE_SIZE.Width, Configuration.DOCUMENT_MARGIN_TOP);
                var rect = new XRect(size);
                gfx.DrawString(text, Configuration.HEADER_FONT, Configuration.HEADER_FONT_BRUSH, rect, format);

                gfx.Restore(state);
            }
        }

        public static void DrawHeader(this PdfDocument document, string text)
        {
            document.DrawHeader(text, Enumerable.Range(1, document.Pages.Count).ToArray());
        }

        public static void DrawHeader(this PdfDocument document, string text, params int[] pages)
        {
            foreach (var page in pages)
            {
                document.Pages[page - 1].DrawPageHeader(text);
            }
        }

        public static void DrawPageFooter(this PdfPage page, string text)
        {
            using (var gfx = XGraphics.FromPdfPage(page))
            {
                var state = gfx.Save();

                gfx.TranslateTransform(Configuration.DOCUMENT_MARGIN_H, Configuration.DOCUMENT_SIZE.Height - Configuration.DOCUMENT_MARGIN_BOTTOM);
                XStringFormat format = new XStringFormat();
                format.Alignment = XStringAlignment.Far;
                format.LineAlignment = XLineAlignment.Near;
                var size = new XSize(Configuration.EFFECTIVE_PAGE_SIZE.Width, Configuration.DOCUMENT_MARGIN_BOTTOM);
                var rect = new XRect(size);
                gfx.DrawString(text, Configuration.FOOTER_FONT, Configuration.FOOTER_FONT_BRUSH, rect, format);

                gfx.Restore(state);
            }
        }

        public static void DrawFooter(this PdfDocument document, string text)
        {
            foreach (var page in document.Pages)
            {
                page.DrawPageFooter(text);
            }
        }
    }
}
