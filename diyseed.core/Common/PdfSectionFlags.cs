using System;

namespace Diyseed.Core
{
    [Flags]
    public enum PdfSectionFlags
    {
        None = 0,
        Writer = 1,
        Reader = 2,
        Manual = 4
    }
}
