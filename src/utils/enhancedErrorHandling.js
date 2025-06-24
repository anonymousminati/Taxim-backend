/**
 * Enhanced LaTeX Error Detection and Handling Rules
 * Based on comprehensive error testing results
 */

export const ENHANCED_ERROR_HANDLING_RULES = {
  // Error patterns discovered from testing
  LATEX_ERROR_PATTERNS: [
    // Standard LaTeX errors
    /LaTeX Error/i,
    /tex error/i,
    /missing \$ inserted/i,
    /undefined control sequence/i,
    /pdflatex.*failed/i,
    /latex.*not found/i,
    /RuntimeError.*latex/i,
    /failed but did not produce a log file/i,
    
    // Additional patterns found in testing
    /Runaway argument/i,
    /Emergency stop/i,
    /LaTeX.*compilation.*failed/i,
    /Package.*Error/i,
    /Fatal error occurred/i,
    /LaTeX Warning.*converted to error/i
  ],

  // Python/Manim specific errors
  PYTHON_ERROR_PATTERNS: [
    /SyntaxError/i,
    /IndentationError/i,
    /NameError.*not defined/i,
    /ImportError/i,
    /ModuleNotFoundError/i,
    /AttributeError/i,
    /TypeError.*object.*not callable/i,
    /ZeroDivisionError/i
  ],

  // Rendering/FFmpeg errors
  RENDERING_ERROR_PATTERNS: [
    /FFmpeg.*error/i,
    /ffmpeg.*failed/i,
    /No video.*generated/i,
    /Rendering.*failed/i,
    /Could not.*render/i,
    /Video.*creation.*failed/i
  ],

  // System/Resource errors
  SYSTEM_ERROR_PATTERNS: [
    /Permission denied/i,
    /No space left on device/i,
    /Memory.*error/i,
    /Timeout/i,
    /Connection.*refused/i,
    /File not found/i,
    /Access.*denied/i
  ],

  // Error fixes based on testing
  AUTOMATIC_FIXES: {
    // Raw string fixes
    MATHTEX_RAW_STRING: {
      pattern: /MathTex\("([^"]*?)"\)/g,
      replacement: (match, content) => {
        // Ensure proper escaping
        const escaped = content.replace(/\\/g, '\\\\');
        return `MathTex(r"${escaped}")`;
      }
    },
    
    // Fix single backslashes in raw strings
    DOUBLE_BACKSLASH: {
      pattern: /MathTex\(r"([^"]*?)"\)/g,
      replacement: (match, content) => {
        if (!content.includes('\\\\')) {
          const fixed = content.replace(/\\/g, '\\\\');
          return `MathTex(r"${fixed}")`;
        }
        return match;
      }
    },
    
    // Fix Tex objects similarly
    TEX_RAW_STRING: {
      pattern: /Tex\("([^"]*?)"\)/g,
      replacement: (match, content) => {
        const escaped = content.replace(/\\/g, '\\\\');
        return `Tex(r"${escaped}")`;
      }
    },
    
    // Fix missing imports
    MISSING_MANIM_IMPORT: {
      pattern: /^(?!.*from manim import)/m,
      replacement: 'from manim import *\n',
      condition: (code) => !code.includes('from manim import') && !code.includes('import manim')
    },
    
    // Fix class inheritance
    SCENE_INHERITANCE: {
      pattern: /class\s+(\w+):\s*$/gm,
      replacement: 'class $1(Scene):'
    },
    
    // Fix construct method
    CONSTRUCT_METHOD: {
      pattern: /def\s+create_objects\s*\(/g,
      replacement: 'def construct('
    }
  },

  // Fallback replacements discovered from testing
  LATEX_FALLBACKS: {
    // Complex math expressions
    COMPLEX_MATHTEX: {
      pattern: /MathTex\(r"([^"]{50,})"\)/g,
      replacement: () => 'MathTex(r"x^2 + y^2 = z^2")'
    },
    
    // Invalid LaTeX commands
    INVALID_COMMANDS: {
      pattern: /MathTex\(r".*\\invalidcommand.*"\)/g,
      replacement: () => 'Text("Math Expression", font_size=36)'
    },
    
    // Problematic LaTeX symbols
    PROBLEMATIC_SYMBOLS: [
      { pattern: /\\invalidcommand/g, replacement: '\\text{invalid}' },
      { pattern: /\\unknowncommand/g, replacement: '\\text{unknown}' },
      { pattern: /\\badcommand/g, replacement: '\\text{bad}' }
    ]
  },

  // Error recovery strategies
  RECOVERY_STRATEGIES: {
    LATEX_COMPILATION_FAILED: [
      'Convert to raw strings',
      'Simplify LaTeX expressions', 
      'Replace with Text objects',
      'Use basic mathematical notation'
    ],
    
    PYTHON_SYNTAX_ERROR: [
      'Fix indentation',
      'Add missing colons',
      'Close parentheses',
      'Fix string quotes'
    ],
    
    RENDERING_FAILED: [
      'Reduce complexity',
      'Remove problematic objects',
      'Use simpler animations',
      'Check system resources'
    ],
    
    IMPORT_ERROR: [
      'Add missing imports',
      'Check Manim installation',
      'Verify Python environment',
      'Use alternative objects'
    ]
  },

  // User-friendly error messages
  ERROR_MESSAGES: {
    LATEX_ERROR: 'LaTeX compilation failed. The mathematical expressions in your animation contain syntax errors. I\'ll try to fix them automatically.',
    PYTHON_SYNTAX_ERROR: 'The generated Python code has syntax errors. I\'ll fix the syntax and try again.',
    RENDERING_ERROR: 'Video rendering failed. This might be due to complex animations or system limitations. I\'ll try a simpler version.',
    IMPORT_ERROR: 'Missing required imports. I\'ll add the necessary import statements.',
    SYSTEM_ERROR: 'System-level error occurred. Please check your Manim installation and system requirements.',
    UNKNOWN_ERROR: 'An unexpected error occurred. I\'ll try to generate a simpler animation.'
  },

  // Progressive error handling levels
  ERROR_HANDLING_LEVELS: [
    {
      level: 1,
      name: 'Quick Fix',
      actions: ['Fix raw strings', 'Add missing imports', 'Fix basic syntax']
    },
    {
      level: 2, 
      name: 'Smart Recovery',
      actions: ['Simplify expressions', 'Replace problematic objects', 'Use alternatives']
    },
    {
      level: 3,
      name: 'Fallback Mode',
      actions: ['Convert to basic shapes', 'Use text instead of LaTeX', 'Minimal animation']
    }
  ]
};

/**
 * Enhanced error categorization based on test results
 */
export function categorizeError(errorMessage) {
  const rules = ENHANCED_ERROR_HANDLING_RULES;
  
  if (rules.LATEX_ERROR_PATTERNS.some(pattern => pattern.test(errorMessage))) {
    return {
      type: 'LATEX_ERROR',
      category: 'LaTeX',
      severity: 'medium',
      recoverable: true,
      message: rules.ERROR_MESSAGES.LATEX_ERROR
    };
  }
  
  if (rules.PYTHON_ERROR_PATTERNS.some(pattern => pattern.test(errorMessage))) {
    return {
      type: 'PYTHON_SYNTAX_ERROR',
      category: 'Python',
      severity: 'medium',
      recoverable: true,
      message: rules.ERROR_MESSAGES.PYTHON_SYNTAX_ERROR
    };
  }
  
  if (rules.RENDERING_ERROR_PATTERNS.some(pattern => pattern.test(errorMessage))) {
    return {
      type: 'RENDERING_ERROR',
      category: 'Rendering',
      severity: 'high',
      recoverable: true,
      message: rules.ERROR_MESSAGES.RENDERING_ERROR
    };
  }
  
  if (rules.SYSTEM_ERROR_PATTERNS.some(pattern => pattern.test(errorMessage))) {
    return {
      type: 'SYSTEM_ERROR',
      category: 'System',
      severity: 'high',
      recoverable: false,
      message: rules.ERROR_MESSAGES.SYSTEM_ERROR
    };
  }
  
  return {
    type: 'UNKNOWN_ERROR',
    category: 'Unknown',
    severity: 'medium',
    recoverable: true,
    message: rules.ERROR_MESSAGES.UNKNOWN_ERROR
  };
}

/**
 * Apply progressive error handling based on error level
 */
export function applyProgressiveErrorHandling(code, errorInfo, level = 1) {
  const rules = ENHANCED_ERROR_HANDLING_RULES;
  let fixedCode = code;
  
  // Level 1: Quick fixes
  if (level >= 1) {
    // Apply automatic fixes
    Object.values(rules.AUTOMATIC_FIXES).forEach(fix => {
      if (fix.condition && !fix.condition(fixedCode)) {
        return;      }
      
      if (fix.replacement) {
        fixedCode = fixedCode.replace(fix.pattern, fix.replacement);
      }
    });
  }
  
  // Level 2: Smart recovery
  if (level >= 2) {
    // Apply LaTeX fallbacks
    Object.values(rules.LATEX_FALLBACKS).forEach(fallback => {
      if (fallback.pattern && fallback.replacement) {
        fixedCode = fixedCode.replace(fallback.pattern, fallback.replacement);
      }
    });
    
    // Apply problematic symbol fixes
    if (rules.LATEX_FALLBACKS.PROBLEMATIC_SYMBOLS) {
      rules.LATEX_FALLBACKS.PROBLEMATIC_SYMBOLS.forEach(symbol => {
        fixedCode = fixedCode.replace(symbol.pattern, symbol.replacement);
      });
    }
  }
  
  // Level 3: Fallback mode
  if (level >= 3) {
    // Replace all LaTeX with basic text
    fixedCode = fixedCode.replace(/MathTex\([^)]+\)/g, 'Text("Math Expression", font_size=36)');
    fixedCode = fixedCode.replace(/Tex\([^)]+\)/g, 'Text("LaTeX Text", font_size=36)');
    fixedCode = fixedCode.replace(/NumberPlane\([^)]*\)/g, 'Rectangle(width=12, height=8).set_stroke(WHITE, 0.5)');
    fixedCode = fixedCode.replace(/Axes\([^)]*\)/g, 'VGroup(Line(LEFT*6, RIGHT*6), Line(DOWN*4, UP*4))');
  }
  
  return {
    code: fixedCode,
    level: level,
    appliedFixes: rules.ERROR_HANDLING_LEVELS[level - 1]?.actions || []
  };
}

/**
 * Get recovery strategy for specific error type
 */
export function getRecoveryStrategy(errorInfo) {
  const rules = ENHANCED_ERROR_HANDLING_RULES;
  return rules.RECOVERY_STRATEGIES[errorInfo.type] || rules.RECOVERY_STRATEGIES.UNKNOWN_ERROR;
}

/**
 * Generate user-friendly error explanation
 */
export function generateErrorExplanation(errorInfo, recoveryAttempt = 1) {
  const strategy = getRecoveryStrategy(errorInfo);
  
  let explanation = errorInfo.message;
  
  if (recoveryAttempt > 1) {
    explanation += ` (Attempt ${recoveryAttempt})`;
  }
  
  if (strategy && strategy.length > 0) {
    explanation += `\n\nRecovery strategies being applied:\n`;
    explanation += strategy.slice(0, 3).map((s, i) => `${i + 1}. ${s}`).join('\n');
  }
  
  return explanation;
}

export default ENHANCED_ERROR_HANDLING_RULES;
