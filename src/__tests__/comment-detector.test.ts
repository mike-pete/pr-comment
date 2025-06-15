// @ts-nocheck
import { 
  detectPRComments, 
  removePRComment, 
  removePRComments,
  DetectionOptions 
} from '../comment-detector';

describe('Comment Detection Engine', () => {
  describe('detectPRComments', () => {
    describe('Single-line comments', () => {
      it('should detect basic single-line PR comments', () => {
        const code = `
function test() {
  // PR: This needs optimization
  console.log('hello');
}`;
        
        const comments = detectPRComments(code);
        
        expect(comments).toHaveLength(1);
        expect(comments[0]).toMatchObject({
          content: 'This needs optimization',
          lineNumber: 3,
          type: 'single',
          fullMatch: '// PR: This needs optimization'
        });
      });

      it('should detect multiple single-line PR comments', () => {
        const code = `
// PR: Comment at top
function test() {
  // PR: Comment in function
  return true; // PR: Comment at end of line
}`;
        
        const comments = detectPRComments(code);
        
        expect(comments).toHaveLength(3);
        expect(comments[0]!.content).toBe('Comment at top');
        expect(comments[1]!.content).toBe('Comment in function');
        expect(comments[2]!.content).toBe('Comment at end of line');
      });

      it('should handle different spacing around PR prefix', () => {
        const code = `
//PR:No spaces
// PR: Normal spaces
//  PR:   Extra spaces
//PR:    Mixed spacing   `;
        
        const comments = detectPRComments(code);
        
        expect(comments).toHaveLength(4);
        expect(comments[0]!.content).toBe('No spaces');
        expect(comments[1]!.content).toBe('Normal spaces');
        expect(comments[2]!.content).toBe('Extra spaces');
        expect(comments[3]!.content).toBe('Mixed spacing');
      });

      it('should ignore comments without PR prefix', () => {
        const code = `
// Regular comment
// PR: This should be found
// Another regular comment
// PR: This should also be found`;
        
        const comments = detectPRComments(code);
        
        expect(comments).toHaveLength(2);
        expect(comments[0]!.content).toBe('This should be found');
        expect(comments[1]!.content).toBe('This should also be found');
      });
    });

    describe('Multi-line comments', () => {
      it('should detect inline multi-line PR comments', () => {
        const code = `
function test() {
  /* PR: This is inline */ console.log('hello');
  return /* PR: Another inline comment */ true;
}`;
        
        const comments = detectPRComments(code);
        
        expect(comments).toHaveLength(2);
        expect(comments[0]).toMatchObject({
          content: 'This is inline',
          lineNumber: 3,
          type: 'multi',
          fullMatch: '/* PR: This is inline */'
        });
        expect(comments[1]).toMatchObject({
          content: 'Another inline comment',
          lineNumber: 4,
          type: 'multi'
        });
      });

      it('should detect multi-line spanning PR comments', () => {
        const code = `
function test() {
  /* PR: This comment
     spans multiple lines
     and should be detected */
  console.log('hello');
}`;
        
        const comments = detectPRComments(code);
        
        expect(comments).toHaveLength(1);
        expect(comments[0]).toMatchObject({
          content: 'This comment spans multiple lines and should be detected',
          lineNumber: 3,
          type: 'multi'
        });
      });

      it('should handle mixed single and multi-line comments', () => {
        const code = `
// PR: Single line comment
function test() {
  /* PR: Multi-line comment */ 
  // PR: Another single line
  return true;
}`;
        
        const comments = detectPRComments(code);
        
        expect(comments).toHaveLength(3);
        expect(comments[0]!.type).toBe('single');
        expect(comments[1]!.type).toBe('multi');
        expect(comments[2]!.type).toBe('single');
      });
    });

    describe('Edge cases and false positives', () => {
      it('should ignore PR comments inside string literals', () => {
        const code = `
const message = "// PR: This is inside a string";
const template = \`// PR: This is in a template literal\`;
const anotherString = '/* PR: This is also in a string */';
// PR: This should be detected
`;
        
        const comments = detectPRComments(code);
        
        expect(comments).toHaveLength(1);
        expect(comments[0]!.content).toBe('This should be detected');
      });

      it('should handle escaped quotes in strings correctly', () => {
        const code = `
const message = "This has \\"// PR: escaped quotes\\"";
// PR: This should be detected
const another = 'Another \\'// PR: escaped\\' string';
`;
        
        const comments = detectPRComments(code);
        
        expect(comments).toHaveLength(1);
        expect(comments[0]!.content).toBe('This should be detected');
      });

      it('should handle empty or whitespace-only comments', () => {
        const code = `
// PR:
// PR:   
// PR: Actual content
/* PR: */
/* PR:   */
`;
        
        const comments = detectPRComments(code);
        
        expect(comments).toHaveLength(5);
        expect(comments[0]!.content).toBe('');
        expect(comments[1]!.content).toBe('');
        expect(comments[2]!.content).toBe('Actual content');
        expect(comments[3]!.content).toBe('');
        expect(comments[4]!.content).toBe('');
      });

      it('should calculate correct line numbers and positions', () => {
        const code = `Line 1
Line 2
// PR: Comment on line 3
Line 4
/* PR: Comment on line 5 */
Line 6`;
        
        const comments = detectPRComments(code);
        
        expect(comments).toHaveLength(2);
        expect(comments[0]!.lineNumber).toBe(3);
        expect(comments[0]!.columnStart).toBe(0);
        expect(comments[1]!.lineNumber).toBe(5);
        expect(comments[1]!.columnStart).toBe(0);
      });
    });

    describe('Custom options', () => {
      it('should respect custom comment prefix', () => {
        const code = `
// TODO: This should not be found with PR prefix
// REVIEW: This should be found with REVIEW prefix
// PR: This should not be found with REVIEW prefix
`;
        
        const options: Partial<DetectionOptions> = {
          commentPrefix: 'REVIEW:'
        };
        const comments = detectPRComments(code, options);
        
        expect(comments).toHaveLength(1);
        expect(comments[0].content).toBe('This should be found with REVIEW prefix');
      });

      it('should handle case sensitivity option', () => {
        const code = `
// pr: lowercase prefix
// PR: uppercase prefix
// Pr: mixed case prefix
`;
        
        const caseSensitive = detectPRComments(code, { caseSensitive: true });
        const caseInsensitive = detectPRComments(code, { caseSensitive: false });
        
        expect(caseSensitive).toHaveLength(1); // Only uppercase PR:
        expect(caseInsensitive).toHaveLength(3); // All variations
      });

      it('should respect include/exclude options', () => {
        const code = `
// PR: Single line comment
/* PR: Multi-line comment */
`;
        
        const onlySingle = detectPRComments(code, { includeMultiline: false });
        const onlyMulti = detectPRComments(code, { includeSingleLine: false });
        const both = detectPRComments(code, { includeMultiline: true, includeSingleLine: true });
        
        expect(onlySingle).toHaveLength(1);
        expect(onlySingle[0].type).toBe('single');
        
        expect(onlyMulti).toHaveLength(1);
        expect(onlyMulti[0].type).toBe('multi');
        
        expect(both).toHaveLength(2);
      });
    });
  });

  describe('removePRComment', () => {
    it('should remove single-line comments correctly', () => {
      const code = `function test() {
  // PR: Remove this comment
  console.log('hello');
}`;
      
      const comments = detectPRComments(code);
      const result = removePRComment(code, comments[0]!);
      
      expect(result).not.toContain('PR: Remove this comment');
      expect(result).toContain('console.log(\'hello\')');
    });

    it('should remove entire line if it only contains PR comment', () => {
      const code = `function test() {
  console.log('before');
  // PR: This line should be completely removed
  console.log('after');
}`;
      
      const comments = detectPRComments(code);
      const result = removePRComment(code, comments[0]!);
      
      const lines = result.split('\n');
      expect(lines.some(line => line.includes('PR:'))).toBe(false);
      expect(result).toContain('console.log(\'before\')');
      expect(result).toContain('console.log(\'after\')');
    });

    it('should remove multi-line comments correctly', () => {
      const code = `function test() {
  /* PR: Remove this multi-line comment */ console.log('hello');
}`;
      
      const comments = detectPRComments(code);
      const result = removePRComment(code, comments[0]!);
      
      expect(result).not.toContain('PR: Remove this multi-line comment');
      expect(result).toContain('console.log(\'hello\')');
    });
  });

  describe('removePRComments', () => {
    it('should remove multiple comments correctly', () => {
      const code = `function test() {
  // PR: First comment to remove
  console.log('hello');
  /* PR: Second comment to remove */
  // PR: Third comment to remove
  return true;
}`;
      
      const comments = detectPRComments(code);
      const result = removePRComments(code, comments);
      
      expect(result).not.toContain('First comment to remove');
      expect(result).not.toContain('Second comment to remove');
      expect(result).not.toContain('Third comment to remove');
      expect(result).toContain('console.log(\'hello\')');
      expect(result).toContain('return true');
    });

    it('should handle comments that affect line numbering', () => {
      const code = `Line 1
// PR: Comment on line 2
Line 3
// PR: Comment on line 4
Line 5`;
      
      const comments = detectPRComments(code);
      const result = removePRComments(code, comments);
      
      // Both PR comment lines should be removed
      const lines = result.split('\n').filter(line => line.trim() !== '');
      expect(lines).toEqual(['Line 1', 'Line 3', 'Line 5']);
    });
  });

  describe('Complex real-world scenarios', () => {
    it('should handle TypeScript code with interfaces and types', () => {
      const code = `
interface User {
  id: number; // PR: Consider using UUID instead
  name: string;
  /* PR: Add email validation */
  email: string;
}

class UserService {
  // PR: Add error handling here
  async getUser(id: number): Promise<User> {
    return fetch(\`/api/users/\${id}\`); // PR: Add proper error handling
  }
}`;
      
      const comments = detectPRComments(code);
      
      expect(comments).toHaveLength(4);
      expect(comments[0].content).toBe('Consider using UUID instead');
      expect(comments[1].content).toBe('Add email validation');
      expect(comments[2].content).toBe('Add error handling here');
      expect(comments[3].content).toBe('Add proper error handling');
    });

    it('should handle JSX code correctly', () => {
      const code = `
function Component() {
  // PR: Add prop validation
  return (
    <div>
      {/* PR: This should be a separate component */}
      <header>
        <h1>Title</h1>
      </header>
      {/* PR: Add loading state */}
      <main>Content</main>
    </div>
  );
}`;
      
      const comments = detectPRComments(code);
      
      expect(comments).toHaveLength(3);
      expect(comments[0].content).toBe('Add prop validation');
      expect(comments[1].content).toBe('This should be a separate component');
      expect(comments[2].content).toBe('Add loading state');
    });

    it('should maintain correct indices for removal', () => {
      const code = `// PR: Comment 1
const a = 1;
// PR: Comment 2  
const b = 2;
// PR: Comment 3
const c = 3;`;
      
      const comments = detectPRComments(code);
      const result = removePRComments(code, comments);
      
      expect(result).toBe(`const a = 1;
const b = 2;
const c = 3;`);
    });
  });
});