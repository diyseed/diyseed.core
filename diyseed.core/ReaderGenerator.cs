using PdfSharpCore.Drawing;
using PdfSharpCore.Pdf;
using System.IO;
using System.Linq;

namespace Diyseed.Core
{
    public class ReaderGenerator
    {
        private PdfDocument document;
        private GeneratorParameters parameters;
        private XGraphicsState state;
        private PdfPage page;
        private XGraphics gfx;

        private readonly XUnit readerBeginPositionX;
        private readonly XUnit readerBeginPositionY;

        private readonly XUnit textboxesBeginPositionX;
        private readonly XUnit textboxesBeginPositionY;


        public ReaderGenerator(GeneratorParameters parameters)
        {
            this.parameters = parameters;

            readerBeginPositionX = Configuration.DOCUMENT_MARGIN_H;
            readerBeginPositionY = Configuration.DOCUMENT_MARGIN_TOP + XUnit.FromMillimeter(15);

            var heightOfReader = parameters.CardSize.Height + 2 * Configuration.READER_CUTLINE_OVERFLOW;
            textboxesBeginPositionX = Configuration.DOCUMENT_MARGIN_H;
            textboxesBeginPositionY = readerBeginPositionY + XUnit.FromMillimeter(15) + +heightOfReader;
        }

        public PdfDocument Generate()
        {
            document = new PdfDocument();

            page = document.AddPage();
            page.DrawPageFooter(Configuration.DOUMENT_FOOTER_TEXT);
            page.Size = Configuration.DOCUMENT_FORMAT;
            gfx = XGraphics.FromPdfPage(page);

            BeginGenerateReader();
            DrawCutline();
            DrawLineSplitters();
            DrawLineCharacters();
            DrawWordSplitters();
            DrawCharacterNumbers();
            DrawGuidelines();
            DrawCutText();
            DrawInsertText();
            DrawWordNumbers();
            EndGenerateReader();
            //
            DrawAllTextBoxes();

            gfx.Dispose();
            return document;
        }

        private void BeginGenerateReader()
        {
            state = gfx.Save();

            gfx.TranslateTransform(readerBeginPositionX, readerBeginPositionY);
        }

        private void EndGenerateReader()
        {
            gfx.Restore(state);
        }

        private void DrawCutline()
        {
            var height = parameters.CardSize.Height + 2 * Configuration.READER_CUTLINE_OVERFLOW;
            var x = 0;
            var y = 0 - Configuration.READER_CUTLINE_OVERFLOW;
            var y2 = y + height;

            gfx.DrawLine(Configuration.RED_DOTTED_PEN, x, y, x, y2);
        }

        private void DrawLineCharacters()
        {
            var font = gfx.GetFontForBox(
                    fontName: Configuration.DOCUMENT_FONT_FAMILY,
                    style: Configuration.CELL_FONT_STYLE,
                    fontSizeRange: Configuration.CELL_FONT_SIZE_RANGE,
                    increaseStep: 0.2,
                    sampleText: "M",
                    maxSize: parameters.CellSize);

            XStringFormat format = new XStringFormat();
            format.Alignment = XStringAlignment.Far;
            format.LineAlignment = XLineAlignment.Center;

            double x = 0 - Configuration.READER_LINE_SEPARATOR_WIDTH;
            double y;
            double width = Configuration.READER_LINE_SEPARATOR_WIDTH - Configuration.READER_ENCODING_CHARS_OFFSET;
            double height = parameters.CellSize.Height;

            char firstRowChar = parameters.SeedEncoding == EncodingType.Alphabet ? 'a' : '0';
            char currentRowChar;
            XRect rect;

            y = parameters.CardPadding;

            for (int section = 1; section <= parameters.CardSplit; section++)
            {
                currentRowChar = firstRowChar;
                for (int i = 0; i < (int)parameters.SeedEncoding; i++)
                {
                    rect = new XRect(x, y, width, height);
                    gfx.DrawString($"{currentRowChar++}", font, XBrushes.Black, rect, format);

                    y += height;
                }
            }
        }

        private void DrawLineSplitters()
        {
            var x = parameters.CardPadding - Configuration.READER_LINE_SEPARATOR_WIDTH;
            var x2 = 0;
            var y = parameters.CardPadding;
            for (int i = 1; i <= (int)parameters.SeedEncoding * parameters.CardSplit + 1; i++)
            {
                gfx.DrawLine(Configuration.READER_LINE_SEPARATOR_PEN, x, y, x2, y);
                y += parameters.CellSize.Height;
            }
            for (int i = 1; i < parameters.CardSplit; i++)
            {
                y = parameters.CardPadding + i * parameters.CellSize.Height * (int)parameters.SeedEncoding;
                gfx.DrawLine(Configuration.READER_LINE_SEPARATOR_PEN, x, y, x2 + parameters.CardSize.Width, y);
            }
        }

        private void DrawWordSplitters()
        {
            var y = 0.0;
            var y2 = parameters.CardSize.Height;
            var x = parameters.CardPadding + parameters.CellSize.Width;
            for (int i = 1; i < parameters.MaxWordsPerSection * 4; i++)
            {
                y = i % 4 == 0 ? (-XUnit.FromMillimeter(5)) * parameters.CardSplit : 0.0;
                x += parameters.CellSize.Width;
                var pen = i % 4 == 0 ? Configuration.DOCUMENT_PEN_THICK : Configuration.DOCUMENT_PEN_THIN;
                gfx.DrawLine(pen, x, y, x, y2);
            }
        }

        private void DrawCharacterNumbers()
        {
            var boxSize = new XSize(parameters.CellSize.Width, XUnit.FromMillimeter(5));
            var font = gfx.GetFontForBox(
                    fontName: Configuration.DOCUMENT_FONT_FAMILY,
                    style: Configuration.CELL_FONT_STYLE,
                    fontSizeRange: Configuration.CELL_FONT_SIZE_RANGE,
                    increaseStep: 0.2,
                    sampleText: "M",
                    maxSize: boxSize);
            XStringFormat format = new XStringFormat();
            format.Alignment = XStringAlignment.Center;
            format.LineAlignment = XLineAlignment.Far;

            var y = 0;
            var x = parameters.CardPadding;
            var currentValue = 4;
            XRect rect;
            for (int i = 1; i <= parameters.MaxWordsPerSection * 4; i++)
            {
                x += boxSize.Width;
                rect = new XRect(x, y, boxSize.Width, boxSize.Height);
                gfx.DrawString($"{currentValue}", font, XBrushes.Black, rect, format);
                if (--currentValue == 0)
                {
                    currentValue = 4;
                }
            }
        }

        private void DrawGuidelines()
        {
            var width = parameters.CardSize.Width + 2 * Configuration.READER_GUIDELINE_OVERFLOW;
            var x = 0;
            var x2 = x + width;
            var topLineY = 0;
            var bottmLineY = topLineY + parameters.CardSize.Height;

            gfx.DrawLine(Configuration.READER_GUIDELINE_PEN, x, topLineY, x2, topLineY);
            gfx.DrawLine(Configuration.READER_GUIDELINE_PEN, x, bottmLineY, x2, bottmLineY);
        }

        private void DrawCutText()
        {
            var x = -Configuration.READER_CUTLINE_ARROW_IMG_SIZE / 2;
            var y = -Configuration.READER_CUTLINE_OVERFLOW - Configuration.READER_CUTLINE_ARROW_IMG_SIZE;
            var width = Configuration.READER_CUTLINE_ARROW_IMG_SIZE;
            var height = Configuration.READER_CUTLINE_ARROW_IMG_SIZE;
            using (var stream = new MemoryStream(Resources.scissors))
            {
                XImage image = XImage.FromStream(() => stream);
                gfx.DrawImage(image, x, y, width, height);
            }

            XStringFormat format = new XStringFormat();
            format.Alignment = XStringAlignment.Center;
            format.LineAlignment = XLineAlignment.Center;
            var textSize = gfx.MeasureString(Configuration.READER_CUTLINE_TEXT, Configuration.READER_CUTLINE_FONT);
            var textBox = new XRect(x - textSize.Width / 4, y - textSize.Height, textSize.Width, textSize.Height);
            gfx.DrawString(Configuration.READER_CUTLINE_TEXT, Configuration.READER_CUTLINE_FONT, XBrushes.Black, textBox, format);

        }

        private void DrawInsertText()
        {

            var x = XUnit.FromMillimeter(5);
            var y = parameters.CardSize.Height / 2 - Configuration.READER_INSERT_ARROW_SIZE / 2;
            var width = Configuration.READER_INSERT_ARROW_SIZE;
            var height = Configuration.READER_INSERT_ARROW_SIZE;
            using (var stream = new MemoryStream(Resources.arrow_left))
            {
                XImage image = XImage.FromStream(() => stream);
                gfx.DrawImage(image, x, y, width, height);
            }

            XStringFormat format = new XStringFormat();
            format.Alignment = XStringAlignment.Center;
            format.LineAlignment = XLineAlignment.Center;
            var textSize = gfx.MeasureString(Configuration.READER_INSERT_ARROW_TEXT, Configuration.READER_INSERT_ARROW_FONT);
            var textBox = new XRect(x + XUnit.FromMillimeter(5) + Configuration.READER_INSERT_ARROW_SIZE, parameters.CardSize.Height / 2 - textSize.Height / 2, textSize.Width, textSize.Height);
            gfx.DrawString(Configuration.READER_INSERT_ARROW_TEXT, Configuration.READER_INSERT_ARROW_FONT, XBrushes.Black, textBox, format);
        }

        private void DrawWordNumbers()
        {
            var boxSize = new XSize(parameters.WordSize.Width, XUnit.FromMillimeter(5));
            var font = gfx.GetFontForBox(
                fontName: Configuration.DOCUMENT_FONT_FAMILY,
                style: Configuration.WORD_NR_FONT_STYLE,
                fontSizeRange: Configuration.WORD_NR_FONT_SIZE_RANGE,
                increaseStep: 1,
                sampleText: "42.",
                maxSize: boxSize);

            XStringFormat format = new XStringFormat();
            format.Alignment = XStringAlignment.Center;
            format.LineAlignment = XLineAlignment.Far;

            int currentNumber;
            double x;
            double y;

            XRect rect;

            for (int section = 1; section <= parameters.CardSplit; section++)
            {
                currentNumber = parameters.MaxWordsPerSection * section;

                x = parameters.CardPadding + parameters.CellSize.Width;
                y = -(boxSize.Height * parameters.CardSplit) + boxSize.Height * (section - 1);

                for (int i = 0; i < parameters.MaxWordsPerSection; i++)
                {
                    rect = new XRect(x, y, boxSize.Width, boxSize.Height);
                    gfx.DrawString((currentNumber).ToString(), font, Configuration.WORD_NR_FONT_BRUSH, rect, format);

                    currentNumber -= 1;
                    x += boxSize.Width;
                }
            }
        }

        //

        private void DrawAllTextBoxes()
        {
            XGraphicsState originalState = gfx.Save();
            gfx.TranslateTransform(textboxesBeginPositionX, textboxesBeginPositionY);

            for (int i = 1; i <= parameters.EffectiveCardCount; i++)
            {
                // draw card number
                var textbox = new XRect(Configuration.READER_TEXTBOX_CARD_NR_SIZE);
                XStringFormat format = new XStringFormat();
                format.Alignment = XStringAlignment.Near;
                format.LineAlignment = XLineAlignment.Center;
                gfx.DrawString(string.Format(Configuration.READER_TEXTBOXES_TITLE_TEXT, i), Configuration.READER_TEXTBOX_CARD_NR_FONT, Configuration.READER_TEXTBOX_CARD_NR_BRUSH, textbox, format);

                //draw text boxes
                gfx.TranslateTransform(0, Configuration.READER_TEXTBOX_CARD_NR_SIZE.Height);
                var card = parameters.GetCardParameters(i);
                var textBoxesHeight = DrawTextBoxesForCard(card.WordsCount, card.Sections.First().WordNumbers.First()).Height + Configuration.READER_TEXTBOX_CARD_NR_SIZE.Height;

                gfx.TranslateTransform(0, textBoxesHeight);
            }

            gfx.Restore(originalState);
        }

        private XSize DrawTextBoxesForCard(int count, int begin = 1)
        {
            XGraphicsState stateToRecover;
            XSize ret = new XSize(0, 0);

            XUnit nextX = 0;
            XUnit nextY = 0;

            bool addVerticalSize = false;
            var boxSize = XSize.Empty;

            for (int i = 0; i < count; i++)
            {
                stateToRecover = gfx.Save();
                gfx.TranslateTransform(nextX, nextY);
                boxSize = DrawTextBox(begin + i);
                if (!addVerticalSize)
                {
                    ret.Width += boxSize.Width;
                }
                else
                {
                    ret.Height += boxSize.Height * 1.5;
                    addVerticalSize = false;
                }

                nextX += boxSize.Width;
                if (nextX + boxSize.Width > page.Width - Configuration.DOCUMENT_MARGIN_H)
                {
                    nextY += boxSize.Height * 1.5;
                    nextX = 0;
                    addVerticalSize = true;
                }
                gfx.Restore(stateToRecover);
            }

            return ret;
        }

        private XSize DrawTextBox(int boxNumber)
        {
            XSize ret = Configuration.READER_TEXTBOX_SIZE;
            ret.Width += Configuration.READER_TEXTBOX_CELL_SIZE.Width;

            //outline
            var x = Configuration.READER_TEXTBOX_CELL_SIZE.Width;
            var y = 0;
            var width = Configuration.READER_TEXTBOX_SIZE.Width;
            var height = Configuration.READER_TEXTBOX_SIZE.Height;
            gfx.DrawRectangle(Configuration.READER_TEXTBOX_OUTLINE_PEN, x, y, width, height);

            //vertical lines
            x = Configuration.READER_TEXTBOX_CELL_SIZE.Width * 2;
            y = 0;
            var y2 = y + Configuration.READER_TEXTBOX_CELL_SIZE.Height;
            for (int i = 0; i < 3; i++)
            {
                gfx.DrawLine(Configuration.READER_TEXTBOX_VERTICAL_LINES_PEN, x, y, x, y2);
                x += Configuration.READER_TEXTBOX_CELL_SIZE.Width;
            }

            //draw number
            x = 0;
            y = 0;
            var textbox = new XRect(x, y, Configuration.READER_TEXTBOX_CELL_SIZE.Width, Configuration.READER_TEXTBOX_CELL_SIZE.Height);
            XStringFormat format = new XStringFormat();
            format.Alignment = XStringAlignment.Center;
            format.LineAlignment = XLineAlignment.Center;
            gfx.DrawString(boxNumber.ToString(), Configuration.READER_TEXTBOX_NR_FONT, XBrushes.Black, textbox, format);

            return ret;
        }


    }
}
