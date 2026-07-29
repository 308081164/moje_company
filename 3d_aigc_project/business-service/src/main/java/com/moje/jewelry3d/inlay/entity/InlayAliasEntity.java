package com.moje.jewelry3d.inlay.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "inlay_alias")
public class InlayAliasEntity {

    @Id
    @Column(length = 36)
    private String id;

    @Column(name = "inlay_id", nullable = false, length = 36)
    private String inlayId;

    @Column(name = "alias_path", nullable = false, length = 1024)
    private String aliasPath;
}
