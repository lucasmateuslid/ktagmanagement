export const printOsDoc = async (schedule: any, tech: any, company: any) => {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Por favor, permita pop-ups para abrir o PDF da OS.");
    return;
  }

  // Import dynamically to avoid circular dependencies if any
  const { storage } = await import("../services/storage");
  const settings = await storage.getSettings();
  const tags = await storage.getTags();

  const logoUrl = company?.logoUrl || settings.customLogoUrlLight || '';
  const appName = company?.legalName || company?.name || settings.customAppName || "MANAGER PRO";
  const cnpjUrl = company?.cnpj || settings.companyCnpj || "CNPJ NÃO CADASTRADO";
  const openingDate = schedule.createdAt
    ? new Date(schedule.createdAt).toLocaleDateString()
    : "";

  // Resolve true identifiers
  let imei = schedule.installedImei || "";
  let tagId = schedule.installedTagImei || "";
  
  const foundDevice = tags.find((t: any) => t.id === imei);
  if (foundDevice) {
      imei = foundDevice.imei || foundDevice.accessoryId || foundDevice.id;
  }
  
  const foundTag = tags.find((t: any) => t.id === tagId);
  if (foundTag) {
      tagId = foundTag.imei || foundTag.accessoryId || foundTag.id;
  }

  const defaultChecklistItemsLeft = [
    "LIMPADORES",
    "AR CONDICIONADO",
    "LUZES DE PAINEL",
    "RÁDIO",
    "VIDRO ELÉTRICO",
    "TETO SOLAR",
    "FAROL BAIXO",
    "SETAS",
    "LUZ DE RÉ",
  ];
  const defaultChecklistItemsRight = [
    "ALERTA",
    "LUZ DE SALÃO",
    "RETROVISOR ELÉTRICO",
    "DESEMBAÇADOR TRASEIRO",
    "PAINEL",
    "FAROL ALTO",
    "LANTERNA",
    "LUZ DE FREIO",
    "TRAVA ELÉTRICA",
  ];

  // Build rows up to max length
  const maxLen = Math.max(
    defaultChecklistItemsLeft.length,
    defaultChecklistItemsRight.length,
  );
  let rows = "";
  for (let i = 0; i < maxLen; i++) {
    const left = defaultChecklistItemsLeft[i] || "";
    const right = defaultChecklistItemsRight[i] || "";

    const getVal = (itemTitle: string, field: 'before' | 'after') => {
        if (!itemTitle) return "";
        const item = schedule.checklist?.find((c: any) => c.item?.toUpperCase() === itemTitle.toUpperCase() || c.name?.toUpperCase() === itemTitle.toUpperCase());
        if (!item || !item[field]) return "";
        if (item[field] === 'OK') return '✔';
        if (item[field] === 'N/OK') return '✖';
        if (item[field] === 'N/A') return 'N/A';
        return item[field] ? '✔' : '✖';
    }

    rows += `
            <tr>
                <td style="font-weight: bold; text-align: left; padding-left: 5px;">${left}</td>
                <td>${getVal(left, 'before')}</td>
                <td>${getVal(left, 'after')}</td>
                <td style="font-weight: bold; text-align: left; padding-left: 5px;">${right}</td>
                <td>${getVal(right, 'before')}</td>
                <td>${getVal(right, 'after')}</td>
            </tr>
        `;
  }

  const checklistContent = `
        <div style="margin-bottom: 5px; margin-top: 5px;">
            <span style="font-weight: bold; font-family: Arial, sans-serif; font-size: 12px;">✖ Com defeito &nbsp;&nbsp;&nbsp; ✔ Sem defeito</span>
        </div>
        <table class="checklist">
            <thead>
                <tr>
                    <th style="width: 25%">ITENS</th>
                    <th style="width: 12.5%">ANTES</th>
                    <th style="width: 12.5%">DEPOIS</th>
                    <th style="width: 25%">ITENS</th>
                    <th style="width: 12.5%">ANTES</th>
                    <th style="width: 12.5%">DEPOIS</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>
    `;

  // Items installed
  const displayedImei = imei;
  const displayedTag = tagId;

  const content = `
        <html>
            <head>
                <title>Ordem de Serviço - ${schedule.osNumber || schedule.id}</title>
                <style>
                    body { font-family: 'Arial', sans-serif; padding: 10px; font-size: 10px; color: #000; }
                    .header-container { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 2px solid #000; }
                    .header-left { display: flex; align-items: center; gap: 15px; }
                    .header-logo { max-width: 90px; max-height: 50px; object-fit: contain; }
                    .header-company-info { display: flex; flex-direction: column; }
                    .header-company-name { font-weight: bold; font-size: 13px; text-transform: uppercase; }
                    .header-company-cnpj { font-size: 11px; font-weight: bold; margin-top: 4px; }
                    .header-right { padding: 10px 20px; border: 1px dashed #666; background: #f5f5f5; text-align: center; font-size: 10px; font-weight: bold; letter-spacing: 0.5px; }
                    
                    .section { margin-bottom: 8px; border: 1px solid #000; }
                    .section-title { background: #eee; padding: 4px; font-weight: bold; border-bottom: 1px solid #000; text-transform: uppercase; font-size: 10px; }
                    .grid { display: flex; flex-wrap: wrap; }
                    .col { flex: 1; padding: 4px; border-right: 1px solid #000; border-bottom: 1px solid #000; box-sizing: border-box; }
                    .grid .col:last-child { border-right: none; }
                    .col strong { display: block; font-size: 8px; color: #555; text-transform: uppercase; margin-bottom: 2px; }
                    .col span { font-size: 10px; font-weight: bold; }
                    
                    table.checklist { width: 100%; border-collapse: collapse; font-size: 9px; }
                    table.checklist th, table.checklist td { border: 1px solid #000; padding: 2px; text-align: center; height: 18px; }
                    
                    .signatures { margin-top: 20px; display: flex; justify-content: space-between; text-align: center; }
                    .sig-line { width: 45%; font-weight: bold; }
                    .disclaimer { font-size: 8px; text-align: justify; margin: 6px 0; border: 1px solid #000; padding: 6px; }
                    .obs-box { height: 35px; border: 1px solid #000; margin-top: 6px; padding: 5px; }
                    @media print {
                        body { padding: 0; margin: 0; }
                        @page { margin: 15mm; }
                    }
                </style>
            </head>
            <body>
                <div class="header-container">
                    <div class="header-left">
                        ${logoUrl ? `<img src="${logoUrl}" class="header-logo" />` : ""}
                        <div class="header-company-info">
                            <span class="header-company-name">${appName}</span>
                            <span class="header-company-cnpj">CNPJ: ${cnpjUrl}</span>
                        </div>
                    </div>
                    <div class="header-right">
                        ORDEM DE SERVIÇO | #${schedule.osNumber || schedule.id.slice(0, 8).toUpperCase()}
                        <br/><br/>
                        DATA DE ABERTURA: ${openingDate}
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">DADOS DO SERVIÇO</div>
                    <div class="grid">
                        <div class="col" style="flex: 2"><strong>Tipo de Serviço:</strong> <span>${schedule.serviceType || "N/A"}</span></div>
                        <div class="col"><strong>Data Agendada:</strong> <span>${schedule.preferredDate || ""} ${schedule.preferredTime || ""}</span></div>
                    </div>
                    <div class="grid">
                        <div class="col"><strong>Prestador:</strong> <span>${tech?.name || "N/A"}</span></div>
                        <div class="col"><strong>Regional:</strong> <span>${company?.name || "N/A"}</span></div>
                        <div class="col"><strong>Equipamento / Instalação:</strong> <span>${schedule.deviceType || "N/A"}</span></div>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">DADOS DO CLIENTE</div>
                    <div class="grid">
                        <div class="col" style="flex: 2"><strong>Nome / Razão Social:</strong> <span>${schedule.clientName || schedule.requesterName || "N/A"}</span></div>
                        <div class="col"><strong>Telefone:</strong> <span>${schedule.clientPhone || "N/A"}</span></div>
                        <div class="col"><strong>Situação Associado:</strong> <span>${schedule.clientStatus || "___________________"}</span></div>
                    </div>
                    <div class="grid">
                        <div class="col"><strong>Local de Execução:</strong> <span>${schedule.locationAddress || "N/A"}</span></div>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">DADOS DO VEÍCULO</div>
                    <div class="grid">
                        <div class="col"><strong>Placa:</strong> <span>${schedule.vehiclePlate || "N/A"}</span></div>
                        <div class="col" style="flex: 2"><strong>Modelo:</strong> <span>${schedule.vehicleModel || "N/A"}</span></div>
                        <div class="col"><strong>Situação Veículo:</strong> <span>${schedule.vehicleStatus || "___________________"}</span></div>
                    </div>
                    <div class="grid">
                        <div class="col"><strong>Chassi:</strong> <span>${schedule.vehicleChassis || "___________________"}</span></div>
                        <div class="col"><strong>Cor:</strong> <span>${schedule.vehicleColor || "___________________"}</span></div>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title" style="border-bottom: none; background: transparent; text-align: left; padding-left: 0; margin-bottom: -5px;">CHECKLIST:</div>
                    ${checklistContent}
                </div>

                <div class="section">
                    <div class="section-title">ITENS INSTALADOS</div>
                    <div class="grid">
                        <div class="col"><strong>IMEI do Rastreador:</strong> <br/><span>${displayedImei || "___________________"}</span></div>
                        <div class="col"><strong>ID da Tag / Acessório:</strong> <br/><span>${displayedTag || "___________________"}</span></div>
                    </div>
                </div>

                <div class="obs-box">
                    <strong>Observações / Condições do veículo:</strong>
                </div>

                <div class="disclaimer">
                    Declaro para os devidos fins de direito, conforme legislação em vigor, na condição de segurado / representante, manifesto expressa concordância com as avarias e acessórios apontados no presente laudo de vistoria prévia. Declaro-me responsável pelas informações contidas neste documento, afirmando que o serviço foi testado em conjunto e aprovado, não havendo avarias provenientes da instalação ou visita técnica.
                </div>

                <div class="signatures">
                    <div class="sig-line">
                        ${schedule.osSignature ? `<img src="${schedule.osSignature}" style="max-height: 40px; display: block; margin: 0 auto; mix-blend-mode: multiply;" />` : `<div style="height: 40px;"></div>`}
                        <div style="border-top: 1px solid #000; margin-top: 5px; padding-top: 5px;">
                            Assinatura Proprietário / Responsável
                            <br/>
                            <span style="font-size: 10px; font-weight: normal">${schedule.clientName || schedule.requesterName || "N/A"}</span>
                        </div>
                    </div>
                    <div class="sig-line">
                        ${tech?.signature ? `<img src="${tech.signature}" style="max-height: 40px; display: block; margin: 0 auto; mix-blend-mode: multiply;" />` : `<div style="height: 40px;"></div>`}
                        <div style="border-top: 1px solid #000; margin-top: 5px; padding-top: 5px;">
                            Assinatura do Técnico
                            <br/>
                            <span style="font-size: 10px; font-weight: normal">${tech?.name || "N/A"}</span>
                        </div>
                    </div>
                </div>
            </body>
        </html>
    `;

  printWindow.document.write(content);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 500);
};
