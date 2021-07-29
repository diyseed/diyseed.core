using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using Diyseed.Core;
using PdfSharpCore.Drawing;

namespace Diyseed.App
{
    class Program
    {
        static void Main(string[] args)
        {
            // required parameters
            int length;
            int count;
            XUnit width;
            XUnit height;

            // optional parameters
            int split;
            int copies;
            // optional, not bother to load...
            PdfSectionFlags sections = PdfSectionFlags.Reader | PdfSectionFlags.Writer | PdfSectionFlags.Manual;
            EncodingType encoding = EncodingType.Alphabet;

            Console.WriteLine($"DIYseed generator - crypto-wallet seed backup\r");
            Console.WriteLine("------------------------\n");
            length = ReadInt(Configuration.SEED_LENGTH_RANGE, false, -1,
                "Type seed length (number of words)",
                "Wrong format. Allowed range is 10-39");
            count = ReadInt(Configuration.CARD_COUNT_RANGE, false, -1,
                "Type number of metal cards",
                "Wrong format. Allowed range is 1-13");
            width = ReadXUnit(Configuration.CARD_WIDTH_RANGE, false, XUnit.Zero,
                "Type metal card width in mm",
                $"Wrong format. Allowed range is {Configuration.CARD_WIDTH_RANGE.Item1.Millimeter}-{Configuration.CARD_WIDTH_RANGE.Item2.Millimeter}");
            height = ReadXUnit(Configuration.CARD_HEIGHT_RANGE, false, XUnit.Zero,
                "Type metal card height in mm",
                $"Wrong format. Allowed range is {Configuration.CARD_HEIGHT_RANGE.Item1.Millimeter}-{Configuration.CARD_HEIGHT_RANGE.Item2.Millimeter}");

            split = ReadInt(Configuration.CARD_SPLIT_RANGE, true, 1,
                "Number of rows of words per card",
                "Wrong format. Allowed range is 1-6");
            copies = ReadInt(Configuration.WRITER_COPIES_RANGE, true, 1,
                "Number of writer stencils copies",
                "Wrong format. Allowed range is 1-10");

            // If you fancy bro, load rest of optionals parameters...

            var parameters = new GeneratorParameters(new XSize(width, height), count, length, split, encoding, copies, sections);
            var manual = File.ReadAllBytes("manual.pdf");
            var generator = new Generator(parameters, manual);
            var doc = generator.Generate();
            var filename = "diyseed.pdf";
            var path = Path.Combine(Environment.CurrentDirectory, filename);
            Console.WriteLine($"Saving file to {path}\r");
            doc.Save(filename);
            Console.WriteLine($"\nPDF file with stencils succesfuly generated.");

            Process process = new Process();
            process.StartInfo = new ProcessStartInfo(path);
            process.StartInfo.UseShellExecute = true;
            process.Start();
        }

        private static int ReadInt(IEnumerable<int> range, bool optional, int defaultValue, string message, string formatMessage)
        {
            int ret;
            string input;
            if (optional)
            {
                Console.Write($"[Press ENTER to skip] ");
            }
            while (true)
            {
                Console.Write($"{message}: ");
                input = Console.ReadLine();

                if (optional && String.IsNullOrWhiteSpace(input))
                {
                    return defaultValue;
                }
                if (int.TryParse(input, out ret) && range.Contains(ret))
                {
                    return ret;
                }
                Console.Write($"{formatMessage}. ");
            }
        }

        private static XUnit ReadXUnit((XUnit, XUnit) range, bool optional, XUnit defaultValue, string message, string formatMessage)
        {
            string input;
            if (optional)
            {
                Console.Write($"[Press ENTER to skip] ");
            }
            while (true)
            {
                Console.Write($"{message}: ");
                input = Console.ReadLine();

                if (optional && String.IsNullOrWhiteSpace(input))
                {
                    return defaultValue;
                }
                if (double.TryParse(input, out double retDouble))
                {
                    var ret = XUnit.FromMillimeter(retDouble);
                    if (range.Item1 <= ret && ret <= range.Item2)
                        return ret;
                }
                Console.Write($"{formatMessage}. ");
            }
        }
    }
}
