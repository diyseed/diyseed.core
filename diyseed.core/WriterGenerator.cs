using PdfSharpCore.Drawing;
using PdfSharpCore.Pdf;

namespace Diyseed.Core
{
    public class WriterGenerator
    {

        private PdfDocument document;
        private int currentPageNumber;
        private XGraphics gfx;

        private GeneratorParameters parameters;

        public WriterGenerator(GeneratorParameters parameters)
        {
            this.parameters = parameters;
        }

        public PdfDocument Generate()
        {
            document = new PdfDocument();
            currentPageNumber = 0;

            for (int i = 1; i <= parameters.Copies; i++)
            {
                RenderSet(i);
            }

            gfx?.Dispose();
            return document;
        }

        public void RenderSet(int set)
        {
            for (int i = 1; i <= parameters.EffectiveCardCount; i++)
            {
                var origin = GetOriginForCard(i + (set - 1) * parameters.EffectiveCardCount, GetCardSafeAreaSize(parameters.CardSize));
                if (origin.Item1 > currentPageNumber)
                {
                    AddPage();
                }

                var state = gfx.Save();
                gfx.TranslateTransform(origin.Item2.X, origin.Item2.Y);
                RenderCard(parameters.GetCardParameters(i));
                gfx.Restore(state);
            }
        }

        public XSize GetCardSafeAreaSize(XSize sizeOfCard)
        {
            return new XSize(sizeOfCard.Width + Configuration.CARD_MARGIN, sizeOfCard.Height + Configuration.CARD_MARGIN);
        }

        private (int, XPoint) GetOriginForCard(int cardNumber, XSize sizeOfCard)
        {
            int cardsPerLine = (int)((Configuration.EFFECTIVE_PAGE_SIZE.Width + Configuration.CARD_MARGIN) / sizeOfCard.Width);
            int linesPerPage = (int)((Configuration.EFFECTIVE_PAGE_SIZE.Height + Configuration.CARD_MARGIN) / sizeOfCard.Height);
            int cardsPerPage = cardsPerLine * linesPerPage;

            int page = ((cardNumber - 1) / cardsPerPage) + 1;
            int numberOnPage = ((cardNumber - 1) % cardsPerPage) + 1;
            int lineOnPage = ((numberOnPage - 1) / cardsPerLine) + 1;
            int numberOnLine = ((numberOnPage - 1) % cardsPerLine) + 1;

            var positionX = sizeOfCard.Width * (numberOnLine - 1);
            var positionY = sizeOfCard.Height * (lineOnPage - 1);
            var point = new XPoint(positionX, positionY);
            return (page, point);
        }

        private void AddPage()
        {
            var page = document.AddPage();
            page.Size = Configuration.DOCUMENT_FORMAT;
            //
            currentPageNumber++;
            //
            gfx?.Dispose();
            gfx = XGraphics.FromPdfPage(page);
            gfx.TranslateTransform(Configuration.DOCUMENT_MARGIN_H, Configuration.DOCUMENT_MARGIN_TOP);
        }

        public void RenderCard(CardParameters card)
        {
            DrawCardOutline(card);
            gfx.TranslateTransform(card.Padding, card.Padding);
            foreach (var section in card.Sections)
            {
                var sectionSize = DrawSection(section);
                gfx.TranslateTransform(0, sectionSize.Height);
            }
        }

        private void DrawCardOutline(CardParameters card)
        {
            XRect rect = new XRect(card.Size);
            var ellipseSize = new XSize(card.Radius * 2, card.Radius * 2);
            gfx.DrawRoundedRectangle(Configuration.DOCUMENT_PEN_NORMAL, rect, ellipseSize);
        }

        private XSize DrawSection(CardSectionParameters section)
        {
            DrawWords(section);
            return section.Size;
        }

        public void DrawWords(CardSectionParameters section)
        {
            var state = gfx.Save();

            var i = 0;
            foreach (var wordNumber in section.WordNumbers)
            {
                //iterate over section words
                if ((section.Number + i) % 2 == 0)
                {
                    //draw shadow if it is odd word
                    DrawShadow(section.WordSize);
                }

                DrawWordOutline(section.WordSize);
                DrawWordNumber(section.WordSize, wordNumber);
                DrawWordHorizontalLines(section.WordSize, section.CellSize, section.Encoding);
                DrawWordVerticalLines(section.WordSize, section.CellSize);
                DrawWordCellCharacters(section.CellSize, section.Encoding);

                gfx.TranslateTransform(section.WordSize.Width, 0);
                i++;
            }

            gfx.Restore(state);
        }

        private void DrawWordOutline(XSize size)
        {
            var rect = new XRect(size);
            gfx.DrawRectangle(Configuration.DOCUMENT_PEN_NORMAL, rect);
        }

        private void DrawShadow(XSize size)
        {
            var rect = new XRect(size);
            gfx.DrawRectangle(null, Configuration.WORD_CELL_SHADE_BRUSH, rect);
        }

        private void DrawWordNumber(XSize size, int number)
        {
            var font = gfx.GetFontForBox(
                fontName: Configuration.DOCUMENT_FONT_FAMILY,
                style: Configuration.WORD_NR_FONT_STYLE,
                fontSizeRange: Configuration.WORD_NR_FONT_SIZE_RANGE,
                increaseStep: 1,
                sampleText: "42.",
                maxSize: size);

            XStringFormat format = new XStringFormat();
            format.Alignment = XStringAlignment.Center;
            format.LineAlignment = XLineAlignment.Near;
            XRect rect = new XRect(size);
            gfx.DrawString(number.ToString(), font, Configuration.WORD_NR_FONT_BRUSH, rect, format);
        }

        private void DrawWordHorizontalLines(XSize size, XSize cellSize, EncodingType encoding)
        {
            var state = gfx.Save();

            XUnit x1 = 0;
            XUnit x2 = size.Width;
            XUnit y12 = cellSize.Height;
            for (int row = 1; row < (int)encoding; row++)
            {
                //iterate over word lines
                gfx.DrawLine(Configuration.DOCUMENT_PEN_THIN, x1, y12, x2, y12);
                y12 += cellSize.Height;
            }
            gfx.Restore(state);
        }

        private void DrawWordVerticalLines(XSize size, XSize cellSize)
        {
            var state = gfx.Save();

            XUnit x12 = cellSize.Width;
            XUnit y1 = 0;
            XUnit y2 = size.Height;
            for (int row = 1; row < 4; row++)
            {
                //iterate over word lines
                gfx.DrawLine(Configuration.DOCUMENT_PEN_THIN, x12, y1, x12, y2);
                x12 += cellSize.Width;
            }
            gfx.Restore(state);
        }

        private void DrawWordCellCharacters(XSize cellSize, EncodingType encoding)
        {
            var state = gfx.Save();

            var currentChar = encoding == EncodingType.Alphabet ? 'a' : '0';
            for (int i = 0; i < (int)encoding; i++)
            {
                DrawLineCells($"{currentChar++}");
                gfx.TranslateTransform(0, cellSize.Height);
            }

            void DrawLineCells(string text)
            {
                var state = gfx.Save();

                var font = gfx.GetFontForBox(
                    fontName: Configuration.DOCUMENT_FONT_FAMILY,
                    style: Configuration.CELL_FONT_STYLE,
                    fontSizeRange: Configuration.CELL_FONT_SIZE_RANGE,
                    increaseStep: 0.2,
                    sampleText: "M",
                    maxSize: parameters.CellSize);
                XStringFormat format = new XStringFormat();
                format.Alignment = XStringAlignment.Center;
                format.LineAlignment = XLineAlignment.Center;

                for (int cell = 0; cell < 4; cell++)
                {
                    var rect = new XRect(cellSize);
                    gfx.DrawString(text, font, Configuration.CELL_FONT_BRUSH, rect, format);
                    gfx.TranslateTransform(cellSize.Width, 0);
                }

                gfx.Restore(state);
            }

            gfx.Restore(state);
        }
    }
}
