"""
DOCX/DOC to HTML Converter with Reading Time Tracker
Converts Word documents to interactive HTML with page-by-page reading time tracking
Uses Word COM automation on Windows for best fidelity, with python-docx fallback
"""

import os
import sys
import base64
import re
from datetime import datetime

# Fix Windows console encoding
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer)
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer)


def calculate_reading_time_seconds(text):
    """Calculate required reading time based on text length"""
    if not text:
        return 3
    words = len(text.split())
    base_time = words * 0.3
    buffer_time = min(5, words * 0.1)
    total_time = base_time + buffer_time
    if total_time < 5:
        total_time = 5
    elif total_time > 120:
        total_time = 120
    return round(total_time, 1)


def convert_docx_with_com(docx_path):
    """
    Convert DOC/DOCX to HTML using Word COM automation (Windows only).
    Returns the path to the converted HTML file.
    """
    import tempfile
    import pythoncom
    pythoncom.CoInitialize()

    docx_path = os.path.abspath(docx_path)
    html_path = os.path.join(tempfile.gettempdir(), os.path.splitext(os.path.basename(docx_path))[0] + '_converted.html')

    word = None
    doc = None
    try:
        import win32com.client
        word = win32com.client.Dispatch('Word.Application')

        # Open document ReadOnly
        doc = word.Documents.Open(docx_path, True, True, False)
        # SaveAs with wdFormatHTML = 8, wdFormatFilteredHTML = 10
        doc.SaveAs(os.path.abspath(html_path), 10)
        doc.Close()
        doc = None
        word.Quit()
        word = None

        return html_path
    except ImportError:
        raise RuntimeError('pywin32 is required for DOC/DOCX COM conversion. Install with: pip install pywin32')
    except Exception as e:
        if doc:
            try: doc.Close()
            except: pass
        if word:
            try: word.Quit()
            except: pass
        raise RuntimeError(f'Word COM conversion failed: {e}')
    finally:
        pythoncom.CoUninitialize()


def extract_docx_content_fallback(docx_path):
    """
    Fallback: Extract content from DOCX using python-docx.
    Returns dict with pages_data, total_pages, etc.
    """
    from docx import Document

    doc = Document(docx_path)
    pages_data = []
    current_text = []
    current_images = []
    page_num = 1
    total_chars = 0

    for para in doc.paragraphs:
        text = para.text.strip()
        style_name = para.style.name if para.style else 'Normal'

        if text:
            total_chars += len(text)
            # Determine heading level
            if style_name.startswith('Heading'):
                try:
                    level = int(style_name.replace('Heading', '').strip())
                except:
                    level = 2
                current_text.append({
                    'type': f'h{min(level, 6)}',
                    'content': text
                })
            else:
                current_text.append({
                    'type': 'p',
                    'content': text
                })

        # Check for images in paragraph
        for run in para.runs:
            if run._element.findall('.//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}drawing'):
                current_images.append({'type': 'image_placeholder'})

        # Page break detection
        if para._element.findall('.//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}br[@{http://schemas.openxmlformats.org/wordprocessingml/2006/main}type="page"]'):
            combined_text = ' '.join(t['content'] for t in current_text if 'content' in t)
            pages_data.append({
                'page_num': page_num,
                'text_blocks': current_text,
                'required_time': calculate_reading_time_seconds(combined_text),
            })
            current_text = []
            current_images = []
            page_num += 1

    # Remaining content as last page
    if current_text:
        combined_text = ' '.join(t['content'] for t in current_text if 'content' in t)
        pages_data.append({
            'page_num': page_num,
            'text_blocks': current_text,
            'required_time': calculate_reading_time_seconds(combined_text),
        })

    if not pages_data:
        pages_data.append({
            'page_num': 1,
            'text_blocks': [{'type': 'p', 'content': 'This document appears to be empty.'}],
            'required_time': 3,
        })

    return {
        'total_pages': len(pages_data),
        'pages_data': pages_data,
        'total_chars': total_chars,
        'title': os.path.splitext(os.path.basename(docx_path))[0],
    }


def generate_html_from_com(html_path, material_id=''):
    """Read the COM-generated HTML and wrap it with reading tracker UI"""
    with open(html_path, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()

    # Extract text content for reading time calculation
    text_content = re.sub(r'<[^>]+>', ' ', content)
    text_content = re.sub(r'\s+', ' ', text_content).strip()
    reading_time = calculate_reading_time_seconds(text_content)
    word_count = len(text_content.split())

    # Estimate pages by content length
    chars_per_page = 3000
    estimated_pages = max(1, len(text_content) // chars_per_page)

    html = f'''<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body {{ margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background: #f8f9fa; }}
  .reader-container {{ display: flex; flex-direction: column; height: 100vh; }}
  .toolbar {{ background: white; border-bottom: 1px solid #e2e8f0; padding: 8px 16px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }}
  .toolbar-left {{ display: flex; align-items: center; gap: 12px; }}
  .toolbar-title {{ font-weight: 600; color: #1e293b; font-size: 14px; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }}
  .toolbar-right {{ display: flex; align-items: center; gap: 16px; }}
  .reading-info {{ font-size: 13px; color: #64748b; }}
  .progress-bar-container {{ width: 200px; height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; }}
  .progress-bar {{ height: 100%; background: #4f46e5; border-radius: 3px; transition: width 0.3s; width: 0%; }}
  .content-area {{ flex: 1; overflow-y: auto; background: white; }}
  .content-area .doc-content {{ max-width: 800px; margin: 0 auto; padding: 40px 24px; line-height: 1.7; }}
  .completed-badge {{ background: #10b981; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; }}
</style>
</head>
<body>
<div class="reader-container">
  <div class="toolbar">
    <div class="toolbar-left">
      <span class="toolbar-title">Document Viewer</span>
      <span class="reading-info" id="readingInfo">{word_count} words &middot; ~{reading_time/60:.1f} min read</span>
    </div>
    <div class="toolbar-right">
      <div class="progress-bar-container">
        <div class="progress-bar" id="progressBar"></div>
      </div>
      <span class="reading-info" id="progressText">0%</span>
      <span class="completed-badge" id="completedBadge" style="display:none">&#10003; Completed</span>
    </div>
  </div>
  <div class="content-area" id="contentArea">
    <div class="doc-content">
      {content}
    </div>
  </div>
</div>
<script>
  const apiBase = '';
  const materialId = '{material_id}';
  let isCompleted = false;

  const contentArea = document.getElementById('contentArea');
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');
  const completedBadge = document.getElementById('completedBadge');

  function updateProgress() {{
    const scrollTop = contentArea.scrollTop;
    const scrollHeight = contentArea.scrollHeight - contentArea.clientHeight;
    const progress = scrollHeight > 0 ? Math.round((scrollTop / scrollHeight) * 100) : 0;
    progressBar.style.width = progress + '%';
    progressText.textContent = progress + '%';

    if (progress >= 90 && !isCompleted) {{
      isCompleted = true;
      completedBadge.style.display = 'inline-block';
      if (apiBase && materialId) {{
        fetch(apiBase + '/materials/' + materialId + '/progress', {{
          method: 'POST',
          headers: {{ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (localStorage.getItem('accessToken') || '') }},
          body: JSON.stringify({{ slideIndex: 1, totalSlides: 1, isCompleted: true }})
        }}).catch(() => {{}});
      }}
    }}
  }}

  contentArea.addEventListener('scroll', updateProgress);
  window.addEventListener('load', () => setTimeout(updateProgress, 500));
</script>
</body>
</html>'''

    return html


def generate_html_from_fallback(result, material_id=''):
    """Generate HTML from python-docx fallback extraction"""
    pages = result['pages_data']

    pages_html = ''
    for page in pages:
        blocks_html = ''
        for block in page['text_blocks']:
            tag = block['type']
            content = block['content']
            blocks_html += f'<{tag}>{content}</{tag}>\n'

        pages_html += f'''
        <div class="page-section" data-page="{page['page_num']}" data-time="{page['required_time']}">
          <div class="page-header">Page {page['page_num']}</div>
          <div class="page-content">{blocks_html}</div>
        </div>'''

    total_time = sum(p['required_time'] for p in pages)
    total_pages = result['total_pages']

    html = f'''<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body {{ margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background: #f8f9fa; }}
  .reader-container {{ display: flex; flex-direction: column; height: 100vh; }}
  .toolbar {{ background: white; border-bottom: 1px solid #e2e8f0; padding: 8px 16px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }}
  .toolbar-left {{ display: flex; align-items: center; gap: 12px; }}
  .toolbar-title {{ font-weight: 600; color: #1e293b; font-size: 14px; }}
  .toolbar-right {{ display: flex; align-items: center; gap: 16px; }}
  .reading-info {{ font-size: 13px; color: #64748b; }}
  .progress-bar-container {{ width: 200px; height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; }}
  .progress-bar {{ height: 100%; background: #4f46e5; border-radius: 3px; transition: width 0.3s; width: 0%; }}
  .content-area {{ flex: 1; overflow-y: auto; background: white; }}
  .page-section {{ max-width: 800px; margin: 20px auto; padding: 30px 24px; border-bottom: 1px solid #e2e8f0; }}
  .page-header {{ font-size: 12px; color: #94a3b8; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px; }}
  .page-content h1 {{ color: #1e293b; margin: 16px 0 8px; }}
  .page-content h2 {{ color: #334155; margin: 14px 0 6px; }}
  .page-content h3 {{ color: #475569; margin: 12px 0 4px; }}
  .page-content p {{ color: #374151; margin: 8px 0; line-height: 1.7; }}
  .completed-badge {{ background: #10b981; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; }}
</style>
</head>
<body>
<div class="reader-container">
  <div class="toolbar">
    <div class="toolbar-left">
      <span class="toolbar-title">{result['title']}</span>
      <span class="reading-info">{total_pages} pages &middot; ~{total_time/60:.1f} min read</span>
    </div>
    <div class="toolbar-right">
      <div class="progress-bar-container">
        <div class="progress-bar" id="progressBar"></div>
      </div>
      <span class="reading-info" id="progressText">0%</span>
      <span class="completed-badge" id="completedBadge" style="display:none">&#10003; Completed</span>
    </div>
  </div>
  <div class="content-area" id="contentArea">
    {pages_html}
  </div>
</div>
<script>
  const apiBase = '';
  const materialId = '{material_id}';
  let isCompleted = false;

  const contentArea = document.getElementById('contentArea');
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');
  const completedBadge = document.getElementById('completedBadge');

  function updateProgress() {{
    const scrollTop = contentArea.scrollTop;
    const scrollHeight = contentArea.scrollHeight - contentArea.clientHeight;
    const progress = scrollHeight > 0 ? Math.round((scrollTop / scrollHeight) * 100) : 0;
    progressBar.style.width = progress + '%';
    progressText.textContent = progress + '%';

    if (progress >= 90 && !isCompleted) {{
      isCompleted = true;
      completedBadge.style.display = 'inline-block';
      if (apiBase && materialId) {{
        fetch(apiBase + '/materials/' + materialId + '/progress', {{
          method: 'POST',
          headers: {{ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (localStorage.getItem('accessToken') || '') }},
          body: JSON.stringify({{ slideIndex: 1, totalSlides: 1, isCompleted: true }})
        }}).catch(() => {{}});
      }}
    }}
  }}

  contentArea.addEventListener('scroll', updateProgress);
  window.addEventListener('load', () => setTimeout(updateProgress, 500));
</script>
</body>
</html>'''

    return html


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description='Convert DOCX/DOC to HTML with reading tracking')
    parser.add_argument('input', help='Input DOCX/DOC file path')
    parser.add_argument('output', help='Output HTML file path')
    parser.add_argument('--material-id', default='', help='Material ID for tracking')

    args = parser.parse_args()

    try:
        input_path = args.input
        use_com = False
        com_html_path = None

        # Try Word COM automation first (best fidelity)
        if sys.platform == 'win32':
            try:
                print("Converting via Word COM automation...")
                com_html_path = convert_docx_with_com(input_path)
                use_com = True
                print(f"Word COM conversion successful: {com_html_path}")
            except Exception as com_err:
                print(f"Word COM failed ({com_err}), falling back to python-docx...", file=sys.stderr)
                use_com = False

        if use_com and com_html_path:
            html = generate_html_from_com(com_html_path, args.material_id)
            # Clean up temp COM HTML
            try:
                os.unlink(com_html_path)
            except:
                pass
        else:
            # Fallback: python-docx
            result = extract_docx_content_fallback(input_path)
            html = generate_html_from_fallback(result, args.material_id)

        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(html)

        print(f"Converted {args.input} to {args.output}")

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
