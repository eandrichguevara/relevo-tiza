"""PDF generation service for evaluations and reports."""
import json
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
)
from reportlab.pdfgen import canvas
import qrcode
from PIL import Image


def generate_evaluation_pdf(evaluation) -> BytesIO:
    """Generate a printable evaluation PDF with structured layout."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "CustomTitle",
        parent=styles["Title"],
        fontSize=16,
        spaceAfter=12,
    )

    story = []

    # Header
    story.append(Paragraph("TIZA — Evaluación", title_style))
    story.append(
        Paragraph(f"<b>Título:</b> {evaluation.title}", styles["Normal"])
    )
    story.append(
        Paragraph(
            f"<b>Asignatura:</b> {evaluation.subject}", styles["Normal"]
        )
    )
    story.append(
        Paragraph(f"<b>Curso:</b> {evaluation.grade}", styles["Normal"])
    )
    story.append(Spacer(1, 1 * cm))

    # Student info placeholder
    story.append(
        Paragraph(
            "<b>Nombre del alumno:</b> ___________________________",
            styles["Normal"],
        )
    )
    story.append(
        Paragraph(
            "<b>Fecha:</b> ___________________________", styles["Normal"]
        )
    )
    story.append(Spacer(1, 1 * cm))

    # Questions
    rubric = evaluation.rubric if isinstance(evaluation.rubric, list) else []
    for i, item in enumerate(rubric):
        q_num = item.get("question_number", i + 1)
        q_type = item.get("type", "written")
        max_score = item.get("max_score", 0)
        statement = item.get("statement", "")

        # Build question header
        question_html = (
            f'<b>Pregunta {q_num}</b> ({q_type}) — {max_score} pts'
        )
        if statement:
            question_html += f'<br/><i>{statement}</i>'

        story.append(
            Paragraph(question_html, styles["Heading3"])
        )

        # Render criteria (new multi-level format or legacy)
        criteria = item.get("criteria")
        if criteria and isinstance(criteria, list):
            criteria_html = ""
            # Detect format: new (name + levels) vs legacy (description + score)
            if criteria and isinstance(criteria[0], dict) and "name" in criteria[0] and "levels" in criteria[0]:
                # New multi-level format
                for criterion in criteria:
                    cname = criterion.get("name", "Criterio")
                    levels = criterion.get("levels", [])
                    criteria_html += f'<b>{cname}</b>'
                    if levels:
                        max_pts = max(l.get("points", 0) for l in levels)
                        criteria_html += f' (máx: {max_pts} pts)'
                    criteria_html += '<br/>'
                    for level in levels:
                        pts = level.get("points", 0)
                        desc = level.get("description", "")
                        criteria_html += f'&nbsp;&nbsp;{pts} pts — {desc}<br/>'
            else:
                # Legacy format
                for criterion in criteria:
                    desc = criterion.get("description", "")
                    score = criterion.get("score", 0)
                    criteria_html += f'• {desc} ({score} pts)<br/>'

            if criteria_html:
                story.append(Paragraph(criteria_html, styles["Normal"]))
                story.append(Spacer(1, 2))

        if q_type == "multiple_choice":
            # Render alternatives
            alternatives = item.get("alternatives")
            if alternatives and isinstance(alternatives, list):
                alt_html = ""
                for alt in alternatives:
                    label = alt.get("label", "")
                    text = alt.get("text", "")
                    is_correct = alt.get("is_correct", False)
                    marker = " ✓" if is_correct else ""
                    alt_html += f'{label}) {text}{marker}<br/>'
                story.append(Paragraph(alt_html, styles["Normal"]))
            else:
                story.append(
                    Paragraph(
                        "A) ________  B) ________  C) ________  D) ________",
                        styles["Normal"],
                    )
                )

            # Show correct answer
            correct = item.get("correct_answer")
            if correct:
                story.append(
                    Paragraph(
                        f'<i>Respuesta correcta: {correct}</i>',
                        styles["Normal"],
                    )
                )
        else:
            # Written answer: show lines for student to write
            for _ in range(3):
                story.append(
                    Paragraph("_" * 60, styles["Normal"])
                )

        story.append(Spacer(1, 0.5 * cm))

    doc.build(story)
    buffer.seek(0)
    return buffer


def generate_result_report_pdf(result) -> BytesIO:
    """Generate a student result report PDF."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Title"],
        fontSize=18,
        textColor=colors.HexColor("#F4813D"),
        spaceAfter=12,
    )

    story = []

    # Header
    story.append(Paragraph("TIZA — Reporte de Evaluación", title_style))

    eval_info = (
        result.evaluation
        if hasattr(result, "evaluation") and result.evaluation
        else None
    )
    if eval_info:
        story.append(
            Paragraph(
                f"<b>Evaluación:</b> {eval_info.title}", styles["Normal"]
            )
        )
        story.append(
            Paragraph(
                f"<b>Asignatura:</b> {eval_info.subject}",
                styles["Normal"],
            )
        )

    story.append(
        Paragraph(
            f"<b>Alumno:</b> {result.student_code}", styles["Normal"]
        )
    )

    if result.final_grade is not None:
        story.append(
            Paragraph(
                f"<b>Nota final:</b> {result.final_grade:.1f}",
                styles["Normal"],
            )
        )
    else:
        story.append(
            Paragraph(
                "<b>Nota:</b> Pendiente de revisión",
                styles["Normal"],
            )
        )

    # Confidence indicator
    confidence_pct = int(result.confidence * 100) if result.confidence else 0
    story.append(
        Paragraph(
            f"<b>Confianza IA:</b> {confidence_pct}%", styles["Normal"]
        )
    )
    story.append(Spacer(1, 1 * cm))

    # Answers detail
    answers = result.answers if isinstance(result.answers, list) else []
    for answer in answers:
        q_num = answer.get("question_number", "?")
        score = answer.get("teacher_score", answer.get("score", 0))
        max_score = answer.get("max_score", 0)
        feedback = answer.get(
            "teacher_correction", answer.get("ai_feedback", "")
        )
        student_answer = answer.get("student_answer", "")

        story.append(
            Paragraph(
                f"<b>Pregunta {q_num}:</b> {score}/{max_score} pts",
                styles["Heading3"],
            )
        )
        story.append(
            Paragraph(
                f"<i>Respuesta del alumno:</i> {student_answer or '(sin respuesta)'}",
                styles["Normal"],
            )
        )
        story.append(
            Paragraph(
                f"<i>Retroalimentación:</i> {feedback}",
                styles["Normal"],
            )
        )
        story.append(Spacer(1, 0.3 * cm))

    story.append(Spacer(1, 2 * cm))
    story.append(
        Paragraph(
            "<i>Este reporte fue generado con asistencia de IA y revisado por el profesor.</i>",
            styles["Italic"],
        )
    )

    doc.build(story)
    buffer.seek(0)
    return buffer


def generate_answer_sheet_pdf(course_name: str, evaluation_title: str, students: list) -> BytesIO:
    """Generate answer sheets for all students in a course."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import cm

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=2*cm, leftMargin=2*cm, topMargin=1.5*cm, bottomMargin=1.5*cm)
    styles = getSampleStyleSheet()
    story = []

    for student in students:
        # Student header
        story.append(Paragraph(f"<b>Hoja de Respuestas</b>", styles['Title']))
        story.append(Paragraph(f"<b>Curso:</b> {course_name}", styles['Normal']))
        story.append(Paragraph(f"<b>Evaluación:</b> {evaluation_title}", styles['Normal']))
        story.append(Paragraph(f"<b>Alumno:</b> {student.full_name}", styles['Normal']))
        story.append(Paragraph(f"<b>Código:</b> {student.student_code}", styles['Normal']))
        story.append(Spacer(1, 1*cm))

        # QR-like identifier
        story.append(Paragraph(f"<i>ID: {student.student_code}</i>", styles['Italic']))
        story.append(Spacer(1, 0.5*cm))

        # Answer spaces
        for i in range(1, 6):
            story.append(Paragraph(f"<b>Pregunta {i}:</b>", styles['Normal']))
            story.append(Paragraph("_" * 70, styles['Normal']))
            story.append(Paragraph("_" * 70, styles['Normal']))
            story.append(Paragraph("_" * 70, styles['Normal']))
            story.append(Spacer(1, 0.3*cm))

        story.append(PageBreak())

    doc.build(story)
    buffer.seek(0)
    return buffer
