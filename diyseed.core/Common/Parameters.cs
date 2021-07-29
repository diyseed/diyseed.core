using System;
using System.Collections.Generic;
using System.Linq;
using PdfSharpCore.Drawing;

namespace Diyseed.Core
{
    public class GeneratorParameters
    {
        /// <summary>
        /// Number of seed words
        /// </summary>
        public int SeedLength { get; }
        /// <summary>
        /// Number of cards (seed is splitted to)
        /// </summary>
        public int CardCount { get; }

        /// <summary>
        /// Size of card to be seed write on.
        /// </summary>
        public XSize CardSize { get; }
        /// <summary>
        /// Radius of card's corner. 
        /// </summary>
        /// 
        public XUnit CardCornerRadius { get; } = Configuration.CARDS_RADIUS_DEFAULT;
        /// <summary>
        /// Padding (inner empty space) of card. Without padding, it is not easy to punch edgy characters.
        /// Recommend to leave default value (1.5mm).
        /// ⚠⚠⚠ YOU HAVE TO REMEMBER THE VALUE, IF YOU CHANGE IT. READER MUST BE GENERATED WITH SAME PADDING TO WORK PROPERLY
        /// </summary>
        public XUnit CardPadding { get; } = Configuration.CARDS_PADDING_DEFAULT;
        /// <summary>
        /// Number of section on card (if card is too height, you can write more rows of words than one,
        /// for example, if you want to write 24-word seed to square card, it is better to split it on
        /// two sections. Cells are square then.)
        /// </summary>
        public int CardSplit { get; } = Configuration.CARD_SPLIT_DEFAULT;
        /// <summary>
        /// Encoding of seed - it may be represented by words(4 characters of alphabet) or by a number 0..2047 (4 characters of 0..9)
        /// Number encoding is useful for small cards, as you need only 10 rows, instead of 27. So you are able for example to encode
        /// 2 words on 2x2cm card
        /// </summary>
        public EncodingType SeedEncoding { get; } = Configuration.CARDS_ENCODING_DEFAULT;
        /// <summary>
        /// Number of writing stencil sets.
        /// </summary>
        public int Copies { get; } = Configuration.WRITER_COPIES_DEFAULT;
        /// <summary>
        /// Specifies, which sections should be generated as part of PDF - writer, reader and manual
        /// </summary>
        public PdfSectionFlags PdfSections { get; } = Configuration.SECTIONS_DEFAULT;

        // computed properties
        public XSize GridSize
        {
            get
            {
                var width = CardSize.Width - 2 * CardPadding;
                var height = CardSize.Height - 2 * CardPadding;

                return new XSize(width, height);
            }
        }
        public XSize CellSize
        {
            get
            {
                var width = WordSize.Width / 4;
                var height = WordSize.Height / (int)SeedEncoding;
                return new XSize(width, height);
            }
        }
        public XSize SectionSize => new XSize(GridSize.Width, GridSize.Height / CardSplit);
        public XSize WordSize => new XSize(SectionSize.Width / MaxWordsPerSection, SectionSize.Height);
        public int TotalSectionCount => CardCount * CardSplit;
        public int MaxWordsPerSection => SeedLength % TotalSectionCount == 0 ? SeedLength / TotalSectionCount : SeedLength / TotalSectionCount + 1;
        public int MaxWordsPerCard => MaxWordsPerSection * CardSplit;
        public int EffectiveCardCount
        {
            get
            {
                var emptyWordsPositions = (CardCount * MaxWordsPerCard) - SeedLength;
                return CardCount - emptyWordsPositions / MaxWordsPerCard;
            }
        }

        public GeneratorParameters(XSize size, int cardCount, int seedLength)
        {
            CheckIntRange(cardCount, Configuration.CARD_COUNT_RANGE);
            CheckIntRange(seedLength, Configuration.SEED_LENGTH_RANGE);
            CheckXUnitRange(size.Width, Configuration.CARD_WIDTH_RANGE);
            CheckXUnitRange(size.Height, Configuration.CARD_HEIGHT_RANGE);

            CardSize = size;
            CardCount = cardCount;
            SeedLength = seedLength;
        }

        public GeneratorParameters(XSize size, int cardCount, int seedLength, int cardSplit, EncodingType encoding, int copies, PdfSectionFlags pdfSections)
            : this(size, cardCount, seedLength)
        {
            CheckIntRange(cardSplit, Configuration.CARD_SPLIT_RANGE);
            CheckIntRange(copies, Configuration.WRITER_COPIES_RANGE);

            CardSplit = cardSplit;
            SeedEncoding = encoding;
            Copies = copies;
            PdfSections = pdfSections;
        }

        public GeneratorParameters(XSize size, int cardCount, int seedLength, int cardSplit, EncodingType encoding, int copies, PdfSectionFlags pdfSections, XUnit radius, XUnit padding)
            : this(size, cardCount, seedLength, cardSplit, encoding, copies, pdfSections)
        {
            CheckXUnitRange(radius, Configuration.CARDS_RADIUS_RANGE);
            CheckXUnitRange(padding, Configuration.CARDS_PADDING_RANGE);

            CardCornerRadius = radius;
            CardPadding = padding;
        }

        private void CheckIntRange(int value, IEnumerable<int> range)
        {
            if (range.Contains(value))
            {
                return;
            }
            throw new ArgumentOutOfRangeException($"{value} out of range. Allowed values are [{string.Join(',', range)}]");
        }

        private void CheckXUnitRange(XUnit value, (XUnit, XUnit) range)
        {
            if (range.Item1 <= value && value <= range.Item2)
            {
                return;
            }
            throw new ArgumentOutOfRangeException($"{value} out of range. Allowed range is [{range.Item1.Millimeter}-{range.Item2.Millimeter}]");
        }

        public CardParameters GetCardParameters(int cardNumber)
        {
            if (cardNumber < 1 || cardNumber > EffectiveCardCount)
            {
                throw new ArgumentException();
            }

            var firstSectionNr = (cardNumber - 1) * CardSplit + 1;
            var lastSectionNr = firstSectionNr + CardSplit - 1;
            var sections = new List<CardSectionParameters>();
            bool wasLastSection = false;
            for (int sectionNr = firstSectionNr; (sectionNr <= lastSectionNr) && !wasLastSection; sectionNr++)
            {
                var firstWordNr = (sectionNr - 1) * MaxWordsPerSection + 1;
                var lastWordNr = firstWordNr + MaxWordsPerSection - 1;
                if (lastWordNr > SeedLength)
                {
                    lastWordNr = SeedLength;
                    wasLastSection = true;
                }
                var count = lastWordNr - firstWordNr + 1;
                var section = new CardSectionParameters(this, sectionNr, Enumerable.Range(firstWordNr, count));
                sections.Add(section);
            }

            return new CardParameters(this, cardNumber, sections);
        }
    }
    public class CardParameters
    {
        private GeneratorParameters _parent;

        public XSize Size => _parent.CardSize;
        public XUnit Radius => _parent.CardCornerRadius;
        public XUnit Padding => _parent.CardPadding;
        //
        public int Number { get; }
        public int WordsCount
        {
            get
            {
                return Sections.Sum(s => s.WordNumbers.Count());
            }
        }
        public IEnumerable<CardSectionParameters> Sections { get; }

        public CardParameters(GeneratorParameters parameters, int number, IEnumerable<CardSectionParameters> sections)
        {
            _parent = parameters;
            Number = number;
            Sections = sections;
        }
    }
    public class CardSectionParameters
    {
        private GeneratorParameters _parameters;

        public EncodingType Encoding => _parameters.SeedEncoding;
        public XSize CellSize => _parameters.CellSize;
        public XSize WordSize => _parameters.WordSize;
        public XSize Size => _parameters.SectionSize;
        //
        public int Number { get; }
        public IEnumerable<int> WordNumbers { get; }

        public CardSectionParameters(GeneratorParameters parameters, int number, IEnumerable<int> wordNumbers)
        {
            _parameters = parameters;
            Number = number;
            WordNumbers = wordNumbers;
        }

    }
}
