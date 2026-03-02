type JsonLdValue = Record<string, unknown> | Array<Record<string, unknown>>;

type JsonLdProps = {
  id?: string;
  value: JsonLdValue;
};

export function JsonLd({ id, value }: JsonLdProps) {
  return (
    <script
      id={id}
      type="application/ld+json"
      // JSON-LD must be rendered as raw JSON string.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(value) }}
    />
  );
}
